import { NextRequest, NextResponse } from 'next/server'
import { createShopifyService } from '@/lib/shopify'
import { DiscountCodeRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandId, codes, ...discountData } = body

    // Validate required fields
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: 'No codes provided' },
        { status: 400 }
      )
    }

    if (!discountData.discountType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const shopifyService = createShopifyService(brandId)
    const results = []

    // Create each code individually
    for (const code of codes) {
      try {
        const result = await shopifyService.createDiscountCode({
          ...discountData,
          code
        })
        results.push({ code, success: true, result })
      } catch (error) {
        results.push({ code, success: false, error: (error as Error).message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    return NextResponse.json({
      message: `Successfully created ${successCount} of ${codes.length} coupon codes`,
      successCount,
      failureCount,
      results
    })
  } catch (error) {
    console.error('Error creating coupons:', error)
    return NextResponse.json(
      { error: 'Failed to create coupons: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const shopifyService = createShopifyService()
    const result = await shopifyService.getDiscountCodes(limit)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching coupons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    )
  }
}
