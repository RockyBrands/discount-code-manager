import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serviceForShop } from '@/lib/shopify-session'
import { getSessionOr401 } from '@/lib/session-token'
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

function buildDiscountInput(group: any): DiscountCodeRequest {
  return {
    discountType: group.discountType,
    discountValue: group.discountValue,
    minimumOrderAmount: group.minimumOrderAmount,
    startsAt: group.startsAt ? group.startsAt.toISOString() : undefined,
    endsAt: group.endsAt ? group.endsAt.toISOString() : undefined,
    customerSelection: group.customerSelection,
    appliesTo: 'collection',
    singleItem: group.singleItem,
    excludedTags: group.excludedTags,
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const mode = body.mode || 'add'

    const group = await prisma.discountGroup.findUnique({
      where: { id: params.id },
      include: { shopDiscounts: { include: { shop: true } }, codes: true },
    })

    if (!group) {
      return NextResponse.json({ error: 'Discount group not found' }, { status: 404 })
    }

    let newCodes: string[] = []
    if (Array.isArray(body.codes)) {
      newCodes = normalizeCodes(body.codes)
    } else if (body.generate && typeof body.generate.prefix === 'string' && typeof body.generate.count === 'number') {
      newCodes = generateCodes(body.generate.prefix, body.generate.count)
    }

    if (newCodes.length === 0) {
      return NextResponse.json({ error: 'No codes provided' }, { status: 400 })
    }

    if (newCodes.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 codes allowed per operation' }, { status: 400 })
    }

    const existingCodes = new Set(group.codes.map(c => c.code.toUpperCase()))
    const usedCodes = new Set(group.codes.filter(c => c.redeemedAt).map(c => c.code.toUpperCase()))

    if (mode === 'replace') {
      // delete existing discount nodes and recreate
      for (const shopDiscount of group.shopDiscounts) {
        try {
          const service = serviceForShop(shopDiscount.shop)
          await service.deleteDiscountCodeNode(shopDiscount.shopifyDiscountId)
        } catch (err) {
          console.error(`Failed to delete existing discount on ${shopDiscount.shop.shopDomain}:`, err)
        }
      }

      await prisma.shopDiscount.deleteMany({ where: { discountGroupId: group.id } })
      await prisma.discountCode.deleteMany({ where: { discountGroupId: group.id } })

      const discountInput = buildDiscountInput(group)
      const storeResults = []

      for (const shop of group.shopDiscounts.map(sd => sd.shop)) {
        if (!group.singleItem && !shop.collectionId) {
          storeResults.push({ shop: shop.shopDomain, success: false, error: 'No collection ID configured' })
          continue
        }

        try {
          const service = serviceForShop(shop)
          const nodeId = await service.createGroupDiscount(group.title, discountInput, newCodes, shop.collectionId || undefined)
          await prisma.shopDiscount.create({
            data: {
              discountGroupId: group.id,
              shopId: shop.id,
              shopifyDiscountId: nodeId,
            },
          })
          storeResults.push({ shop: shop.shopDomain, success: true })
        } catch (err) {
          console.error(`Failed to recreate discount on ${shop.shopDomain}:`, err)
          storeResults.push({ shop: shop.shopDomain, success: false, error: (err as Error).message })
        }
      }

      await prisma.discountCode.createMany({
        data: newCodes.map(code => ({ discountGroupId: group.id, code })),
      })

      return NextResponse.json({ mode: 'replace', codes: newCodes, storeResults })
    }

    // add or block
    const toAdd: string[] = []
    for (const code of newCodes) {
      if (existingCodes.has(code)) continue
      if (mode === 'block' && usedCodes.has(code)) continue
      toAdd.push(code)
    }

    if (toAdd.length === 0) {
      return NextResponse.json({ added: [], skipped: newCodes, mode })
    }

    const storeResults = []
    for (const shopDiscount of group.shopDiscounts) {
      try {
        const service = serviceForShop(shopDiscount.shop)
        await service.addRedeemCodes(shopDiscount.shopifyDiscountId, toAdd)
        storeResults.push({ shop: shopDiscount.shop.shopDomain, success: true })
      } catch (err) {
        console.error(`Failed to add codes to ${shopDiscount.shop.shopDomain}:`, err)
        storeResults.push({ shop: shopDiscount.shop.shopDomain, success: false, error: (err as Error).message })
      }
    }

    const successful = storeResults.filter(r => r.success).length
    if (successful > 0) {
      await prisma.discountCode.createMany({
        data: toAdd.map(code => ({ discountGroupId: group.id, code })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({
      mode,
      added: toAdd,
      skipped: newCodes.filter(c => !toAdd.includes(c)),
      storeResults,
    })
  } catch (error) {
    console.error('Error updating discount codes:', error)
    return NextResponse.json({ error: 'Failed to update discount codes: ' + (error as Error).message }, { status: 500 })
  }
}
