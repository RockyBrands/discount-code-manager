import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookHmac, getRequiredEnv } from '@/lib/shopify-auth'
import { recordRedemptions, processPendingRemovals } from '@/lib/redemption'

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    const hmac = request.headers.get('x-shopify-hmac-sha256')
    const shopHeader = request.headers.get('x-shopify-shop-domain')

    if (!hmac || !shopHeader) {
      return NextResponse.json({ error: 'Missing HMAC' }, { status: 401 })
    }

    const secret = getRequiredEnv('SHOPIFY_API_SECRET')
    if (!verifyWebhookHmac(raw, hmac, secret)) {
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
    }

    const order = JSON.parse(raw)
    const codes: string[] = (order.discount_codes || []).map((d: any) => d.code).filter(Boolean)
    if (codes.length) {
      await recordRedemptions(shopHeader, order.admin_graphql_api_id, codes)
      triggerRemovalWorker(request)
      await processPendingRemovals({ maxElapsedMs: 3000 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing order webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

function triggerRemovalWorker(request: NextRequest) {
  try {
    const secret = process.env.INTERNAL_SHARED_SECRET
    const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
    fetch(`${base}/.netlify/functions/redemption-worker`, {
      method: 'POST',
      headers: secret ? { 'x-internal-secret': secret } : {},
    }).catch(err => console.error('Failed to trigger removal worker:', err))
  } catch (err) {
    console.error('Failed to trigger removal worker:', err)
  }
}
