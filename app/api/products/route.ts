import { NextRequest, NextResponse } from 'next/server'
import { createShopifyService } from '@/lib/shopify'
import { getSessionOr401 } from '@/lib/session-token'

export async function GET(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const limit = parseInt(searchParams.get('limit') || '25')

    const shopifyService = createShopifyService()
    const products = await shopifyService.searchProducts(query, limit)

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error searching products:', error)
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    )
  }
}
