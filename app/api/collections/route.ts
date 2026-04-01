import { NextRequest, NextResponse } from 'next/server'
import { createShopifyService } from '@/lib/shopify'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const limit = parseInt(searchParams.get('limit') || '25')

    const shopifyService = createShopifyService()
    const collections = await shopifyService.searchCollections(query, limit)

    return NextResponse.json(collections)
  } catch (error) {
    console.error('Error searching collections:', error)
    return NextResponse.json(
      { error: 'Failed to search collections' },
      { status: 500 }
    )
  }
}
