import { NextRequest, NextResponse } from 'next/server'
import { createShopifyService, ShopifyService } from '@/lib/shopify'
import { getShopToken } from '@/lib/shopify-session'
import { getSessionOr401 } from '@/lib/session-token'
import { DiscountCodeRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const { brandId, shop, code, codes, ...discountData } = body

    const codesArray: string[] = Array.isArray(codes)
      ? codes
      : typeof code === 'string' && code.trim()
        ? [code.trim()]
        : []

    // Validate required fields
    if (codesArray.length === 0) {
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

    let shopifyService: ShopifyService

    // Embedded-app path: if `shop` is provided, use per-shop token storage
    if (typeof shop === 'string' && shop.trim()) {
      const shopDomain = shop.trim().toLowerCase()
      const accessToken = await getShopToken(shopDomain)
      if (!accessToken) {
        return NextResponse.json(
          {
            error: `Shop not installed or missing token for ${shopDomain}`,
            installUrl: `/api/shopify/auth?shop=${encodeURIComponent(shopDomain)}`,
          },
          { status: 401 }
        )
      }

      const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'
      shopifyService = new ShopifyService(shopDomain, accessToken, apiVersion)
    } else {
      // Backward-compatible path (env-based tokens)
      shopifyService = createShopifyService(brandId)
    }

    const results = []

    // Create each code individually
    for (const code of codesArray) {
      try {
        console.log(`Creating discount code: ${code} for brand: ${brandId}`)
        const result = await shopifyService.createDiscountCode({
          ...discountData,
          code
        })
        console.log(`Successfully created: ${code}`)
        results.push({ code, success: true, result })
      } catch (error) {
        console.error(`Failed to create ${code}:`, error)
        results.push({ code, success: false, error: (error as Error).message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    if (successCount === 0) {
      return NextResponse.json(
        {
          message: `Failed to create ${codesArray.length} of ${codesArray.length} coupon codes`,
          successCount,
          failureCount,
          results,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Successfully created ${successCount} of ${codesArray.length} coupon codes`,
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
  const { response: authError } = await getSessionOr401(request)
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const brandId = searchParams.get('brandId') || undefined
    const shop = searchParams.get('shop') || undefined

    let shopifyService: ShopifyService

    if (shop) {
      const shopDomain = shop.trim().toLowerCase()
      const accessToken = await getShopToken(shopDomain)
      if (!accessToken) {
        return NextResponse.json(
          {
            error: `Shop not installed or missing token for ${shopDomain}`,
            installUrl: `/api/shopify/auth?shop=${encodeURIComponent(shopDomain)}`,
          },
          { status: 401 }
        )
      }

      const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'
      shopifyService = new ShopifyService(shopDomain, accessToken, apiVersion)
    } else {
      shopifyService = createShopifyService(brandId)
    }

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
