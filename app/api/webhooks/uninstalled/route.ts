import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookHmac, getRequiredEnv } from '@/lib/shopify-auth'
import { prisma } from '@/lib/prisma'

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

    await prisma.shop.updateMany({
      where: { shopDomain: shopHeader.toLowerCase() },
      data: { uninstalledAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing uninstall webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
