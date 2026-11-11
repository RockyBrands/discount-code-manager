import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookHmac, getRequiredEnv } from '@/lib/shopify-auth'

// Mandatory compliance topics: customers/data_request, customers/redact, shop/redact.
// The app stores no customer PII (only shop tokens and discount configuration),
// so verification plus acknowledgement is the full handler.
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    const hmac = request.headers.get('x-shopify-hmac-sha256')

    if (!hmac) {
      return NextResponse.json({ error: 'Missing HMAC' }, { status: 401 })
    }

    const secret = getRequiredEnv('SHOPIFY_API_SECRET')
    if (!verifyWebhookHmac(raw, hmac, secret)) {
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
    }

    const topic = request.headers.get('x-shopify-topic')
    const shop = request.headers.get('x-shopify-shop-domain')
    console.log(`Compliance webhook ${topic} for ${shop}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing compliance webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
