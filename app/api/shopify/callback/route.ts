import { NextRequest, NextResponse } from 'next/server'
import { getRequiredEnv, safeCompare, sanitizeShopDomain, verifyHmac } from '@/lib/shopify-auth'
import { upsertShopToken } from '@/lib/shopify-session'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
  const shopParam = url.searchParams.get('shop')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!shopParam || !code || !state) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
  }

  let shop: string
  try {
    shop = sanitizeShopDomain(shopParam)
  } catch {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 })
  }

  const stateCookie = req.cookies.get('shopify_oauth_state')?.value
  if (!stateCookie || !safeCompare(stateCookie, state)) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  const secret = getRequiredEnv('SHOPIFY_API_SECRET')

  const paramsObj: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    paramsObj[key] = value
  })

  if (!verifyHmac(paramsObj, secret)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 400 })
  }

  const clientId = getRequiredEnv('SHOPIFY_API_KEY')
  const hostParam = url.searchParams.get('host')
  const embeddedRedirect = hostParam
    ? new URL(`/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(hostParam)}`, req.url)
    : new URL(`https://${shop}/admin/apps/${clientId}`)

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      code,
    }),
  })

  if (!tokenRes.ok) {
    // Authorization codes are single-use. If this callback fired twice (refresh,
    // double redirect) the first exchange already stored the token — treat a
    // "code already used" failure as success when the shop is installed.
    const existing = await prisma.shop.findUnique({ where: { shopDomain: shop } })
    if (existing?.accessToken && !existing.uninstalledAt) {
      const res = NextResponse.redirect(embeddedRedirect)
      res.cookies.delete('shopify_oauth_state')
      return res
    }
    const txt = await tokenRes.text()
    return NextResponse.json({ error: 'Failed token exchange', details: txt }, { status: 500 })
  }

  const tokenJson = await tokenRes.json()
  const accessToken = tokenJson.access_token as string | undefined
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access_token in response' }, { status: 500 })
  }

  await upsertShopToken(shop, accessToken, tokenJson.scope)

  // Embedded app: relaunch inside Shopify admin so App Bridge can issue
  // session tokens. Without a host param, bounce through the admin apps URL.
  const res = NextResponse.redirect(embeddedRedirect)
  res.cookies.delete('shopify_oauth_state')
  return res
  } catch (error) {
    console.error('OAuth callback failed:', error)
    return NextResponse.json(
      { error: 'OAuth callback failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
