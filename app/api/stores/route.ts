import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOr401 } from '@/lib/session-token'

export async function GET(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const shops = await prisma.shop.findMany({
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
