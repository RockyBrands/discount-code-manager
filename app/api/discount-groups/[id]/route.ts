import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serviceForShop } from '@/lib/shopify-session'
import { getSessionOr401 } from '@/lib/session-token'
import { DiscountCodeRequest } from '@/lib/types'

function toIsoString(value: any) {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return undefined
}

function buildDiscountInput(data: any): DiscountCodeRequest {
  return {
    discountType: data.discountType,
    discountValue: data.discountValue,
    minimumOrderAmount: data.minimumOrderAmount,
    startsAt: toIsoString(data.startsAt),
    endsAt: toIsoString(data.endsAt),
    customerSelection: data.customerSelection || 'all',
    appliesTo: 'collection',
    singleItem: !!data.singleItem,
    excludedTags: Array.isArray(data.excludedTags) ? data.excludedTags.map((t: any) => String(t).trim()).filter(Boolean) : [],
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const group = await prisma.discountGroup.findUnique({
      where: { id: params.id },
      include: {
        codes: { orderBy: { createdAt: 'asc' } },
        shopDiscounts: { include: { shop: { select: { shopDomain: true, collectionId: true } } } },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Discount group not found' }, { status: 404 })
    }

    return NextResponse.json(group)
  } catch (error) {
    console.error('Error fetching discount group:', error)
    return NextResponse.json({ error: 'Failed to fetch discount group' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const existing = await prisma.discountGroup.findUnique({
      where: { id: params.id },
      include: { shopDiscounts: { include: { shop: true } }, codes: { select: { code: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Discount group not found' }, { status: 404 })
    }

    const singleItem = body.singleItem !== undefined ? !!body.singleItem : existing.singleItem
    const excludedTags = Array.isArray(body.excludedTags)
      ? body.excludedTags.map((t: any) => String(t).trim()).filter(Boolean)
      : existing.excludedTags
    const discountType = body.discountType || existing.discountType

    if (singleItem && discountType !== 'percentage') {
      return NextResponse.json({ error: 'Single-item mode only supports percentage discounts' }, { status: 400 })
    }

    const group = await prisma.discountGroup.update({
      where: { id: params.id },
      data: {
        title: body.title ? body.title.trim() : existing.title,
        discountType,
        discountValue: body.discountValue !== undefined ? body.discountValue : existing.discountValue,
        singleItem,
        excludedTags,
        minimumOrderAmount: body.minimumOrderAmount,
        startsAt: body.startsAt ? new Date(body.startsAt) : existing.startsAt,
        endsAt: body.endsAt ? new Date(body.endsAt) : existing.endsAt,
        customerSelection: body.customerSelection || existing.customerSelection,
      },
    })

    const discountInput = buildDiscountInput({
      ...group,
      ...body,
    })
    const codeList = existing.codes.map(c => c.code)

    const storeResults = []
    for (const shopDiscount of existing.shopDiscounts) {
      try {
        const service = serviceForShop(shopDiscount.shop)
        const result = await service.updateGroupDiscount(
          shopDiscount.shopifyDiscountId,
          discountInput,
          codeList,
          shopDiscount.shop.collectionId || undefined,
          group.title
        )
        if (result.recreated) {
          await prisma.shopDiscount.update({
            where: { id: shopDiscount.id },
            data: { shopifyDiscountId: result.nodeId },
          })
        }
        storeResults.push({ shop: shopDiscount.shop.shopDomain, success: true })
      } catch (err) {
        console.error(`Failed to update discount on ${shopDiscount.shop.shopDomain}:`, err)
        storeResults.push({ shop: shopDiscount.shop.shopDomain, success: false, error: (err as Error).message })
      }
    }

    return NextResponse.json({ group, storeResults })
  } catch (error) {
    console.error('Error updating discount group:', error)
    return NextResponse.json({ error: 'Failed to update discount group: ' + (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const existing = await prisma.discountGroup.findUnique({
      where: { id: params.id },
      include: { shopDiscounts: { include: { shop: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Discount group not found' }, { status: 404 })
    }

    for (const shopDiscount of existing.shopDiscounts) {
      try {
        const service = serviceForShop(shopDiscount.shop)
        await service.deleteDiscountCodeNode(shopDiscount.shopifyDiscountId)
      } catch (err) {
        console.error(`Failed to delete discount on ${shopDiscount.shop.shopDomain}:`, err)
      }
    }

    await prisma.discountGroup.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting discount group:', error)
    return NextResponse.json({ error: 'Failed to delete discount group: ' + (error as Error).message }, { status: 500 })
  }
}
