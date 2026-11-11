import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serviceForShop } from '@/lib/shopify-session'
import { getSessionOr401 } from '@/lib/session-token'
import { billingEntityById } from '@/lib/billing-entities'
import { generateUniqueEntityCodes } from '@/lib/code-generator'
import { DiscountCodeRequest } from '@/lib/types'

function generateCodes(prefix: string, count: number) {
  const codes: string[] = []
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  for (let i = 0; i < count; i++) {
    const suffix = (i + 1).toString(36).toUpperCase().padStart(3, '0')
    codes.push(`${prefix}-${ts}-${suffix}`)
  }
  return codes
}

function normalizeCodes(codes: string[]) {
  const seen = new Set<string>()
  return codes
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length > 0 && !seen.has(c) && seen.add(c))
}

function buildDiscountInput(data: any): DiscountCodeRequest {
  return {
    discountType: data.discountType,
    discountValue: data.discountValue,
    minimumOrderAmount: data.minimumOrderAmount,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    customerSelection: data.customerSelection || 'all',
    appliesTo: 'collection',
    singleItem: !!data.singleItem,
    excludedTags: Array.isArray(data.excludedTags) ? data.excludedTags.map((t: any) => String(t).trim()).filter(Boolean) : [],
  }
}

export async function GET(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim() || ''

    const where: Prisma.DiscountGroupWhereInput | undefined = query
      ? {
          OR: [
            { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { codes: { some: { code: { contains: query, mode: Prisma.QueryMode.insensitive } } } },
          ],
        }
      : undefined

    const groups = await prisma.discountGroup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { codes: true } },
        shopDiscounts: { include: { shop: { select: { shopDomain: true } } } },
      },
    })

    const result = groups.map(g => ({
      ...g,
      stores: g.shopDiscounts.map(s => s.shop.shopDomain),
      codeCount: g._count.codes,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching discount groups:', error)
    return NextResponse.json({ error: 'Failed to fetch discount groups' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const { title, discountType, discountValue, minimumOrderAmount, startsAt, endsAt, customerSelection } = body
    const singleItem = !!body.singleItem
    const excludedTags = buildDiscountInput(body).excludedTags

    if (!title || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (singleItem && discountType !== 'percentage') {
      return NextResponse.json({ error: 'Single-item mode only supports percentage discounts' }, { status: 400 })
    }

    let codes: string[] = []
    if (typeof body.billingEntity === 'string' && body.billingEntity) {
      const entity = billingEntityById(body.billingEntity)
      if (!entity) {
        return NextResponse.json({ error: 'Unknown billing entity' }, { status: 400 })
      }
      const count = typeof body.codeCount === 'number' ? Math.floor(body.codeCount) : 1
      if (count < 1 || count > 1000) {
        return NextResponse.json({ error: 'codeCount must be between 1 and 1000' }, { status: 400 })
      }
      const endYear = endsAt ? new Date(endsAt).getFullYear() : new Date().getFullYear()
      codes = await generateUniqueEntityCodes(entity.prefix, endYear, count)
    } else if (Array.isArray(body.codes)) {
      codes = normalizeCodes(body.codes)
    } else if (body.generate && typeof body.generate.prefix === 'string' && typeof body.generate.count === 'number') {
      codes = generateCodes(body.generate.prefix, body.generate.count)
    }

    if (codes.length === 0) {
      return NextResponse.json({ error: 'No codes provided' }, { status: 400 })
    }

    if (codes.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 codes allowed per group' }, { status: 400 })
    }

    const shops = await prisma.shop.findMany()
    if (shops.length === 0) {
      return NextResponse.json({ error: 'No connected stores' }, { status: 400 })
    }

    const group = await prisma.discountGroup.create({
      data: {
        title: title.trim(),
        discountType,
        discountValue,
        minimumOrderAmount,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        customerSelection: customerSelection || 'all',
        singleItem,
        excludedTags,
        usageLimit: 1,
        codes: {
          createMany: { data: codes.map(code => ({ code })) },
        },
      },
      include: { codes: true },
    })

    const discountInput = buildDiscountInput(body)
    const storeResults: { shop: string; success: boolean; error?: string }[] = []

    for (const shop of shops) {
      if (shop.uninstalledAt) {
        storeResults.push({ shop: shop.shopDomain, success: false, error: 'App uninstalled' })
        continue
      }
      if (!singleItem && !shop.collectionId) {
        storeResults.push({ shop: shop.shopDomain, success: false, error: 'No collection ID configured' })
        continue
      }

      try {
        const service = serviceForShop(shop)
        const nodeId = await service.createGroupDiscount(group.title, discountInput, codes, shop.collectionId || undefined)
        await prisma.shopDiscount.create({
          data: {
            discountGroupId: group.id,
            shopId: shop.id,
            shopifyDiscountId: nodeId,
          },
        })
        storeResults.push({ shop: shop.shopDomain, success: true })
      } catch (err) {
        console.error(`Failed to create discount on ${shop.shopDomain}:`, err)
        storeResults.push({ shop: shop.shopDomain, success: false, error: (err as Error).message })
      }
    }

    const successCount = storeResults.filter(r => r.success).length
    if (successCount === 0) {
      await prisma.discountGroup.delete({ where: { id: group.id } })
      return NextResponse.json({ error: 'Failed to create discount on any store', storeResults }, { status: 500 })
    }

    return NextResponse.json({ group, storeResults })
  } catch (error) {
    console.error('Error creating discount group:', error)
    return NextResponse.json({ error: 'Failed to create discount group: ' + (error as Error).message }, { status: 500 })
  }
}
