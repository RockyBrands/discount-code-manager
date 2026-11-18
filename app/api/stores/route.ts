import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOr401 } from '@/lib/session-token'
import { serviceForShop } from '@/lib/shopify-session'

export async function GET(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const shops = await prisma.shop.findMany({
      where: { uninstalledAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shopDomain: true,
        label: true,
        collectionId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(shops)
  } catch (error) {
    console.error('Error fetching stores:', error)
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const { shopDomain, collectionId, label } = body

    if (!shopDomain) {
      return NextResponse.json({ error: 'shopDomain is required' }, { status: 400 })
    }

    const normalized = shopDomain.trim().toLowerCase()
    const existing = await prisma.shop.findUnique({ where: { shopDomain: normalized } })
    if (!existing) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const data: { collectionId?: string; label?: string } = {}
    if (typeof collectionId === 'string') data.collectionId = collectionId.trim()
    if (typeof label === 'string') data.label = label.trim()

    const shop = await prisma.shop.update({
      where: { shopDomain: normalized },
      data,
      select: {
        id: true,
        shopDomain: true,
        label: true,
        collectionId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(shop)
  } catch (error) {
    console.error('Error updating store:', error)
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const shopDomain = typeof body.shopDomain === 'string' ? body.shopDomain.trim().toLowerCase() : ''

    if (!shopDomain) {
      return NextResponse.json({ error: 'shopDomain is required' }, { status: 400 })
    }

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      include: { shopDiscounts: true },
    })

    if (!shop || shop.uninstalledAt) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Best-effort: deactivate the managed discounts on the store so its codes
    // stop working, then mark it disconnected. The shop row stays so the app
    // keeps a record of what was pushed there; reinstalling via OAuth clears
    // uninstalledAt and brings the store back.
    const service = serviceForShop(shop)
    const removedIds: string[] = []
    const failures: { discountId: string; error: string }[] = []
    if (service) {
      for (const shopDiscount of shop.shopDiscounts) {
        try {
          await service.deleteDiscountCodeNode(shopDiscount.shopifyDiscountId)
          removedIds.push(shopDiscount.id)
        } catch (err) {
          console.error(`Failed to delete discount ${shopDiscount.shopifyDiscountId} on ${shopDomain}:`, err)
          failures.push({ discountId: shopDiscount.shopifyDiscountId, error: (err as Error).message })
        }
      }
    } else {
      failures.push({ discountId: '', error: 'Store credentials unavailable' })
    }

    // Drop rows for discounts that were deactivated on Shopify; keep any whose
    // node deletion failed so the link can be retried if the store reconnects.
    if (removedIds.length) {
      await prisma.shopDiscount.deleteMany({ where: { id: { in: removedIds } } })
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { uninstalledAt: new Date() },
    })

    return NextResponse.json({
      disconnected: true,
      discountsRemoved: shop.shopDiscounts.length - failures.length,
      failures: failures.length ? failures : undefined,
    })
  } catch (error) {
    console.error('Error disconnecting store:', error)
    return NextResponse.json({ error: 'Failed to disconnect store' }, { status: 500 })
  }
}
