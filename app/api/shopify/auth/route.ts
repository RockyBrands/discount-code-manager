import { NextRequest, NextResponse } from 'next/server'
import { generateNonce, getAppUrl, getRequiredEnv, sanitizeShopDomain } from '@/lib/shopify-auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shopParam = searchParams.get('shop')
  if (!shopParam) {
    return NextResponse.json({ error: 'Missing shop' }, { status: 400 })
  }

  let shop: string
  try {
    shop = sanitizeShopDomain(shopParam)
  } catch {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 })
  }

  const clientId = getRequiredEnv('SHOPIFY_API_KEY')
  const scopes = getRequiredEnv('SHOPIFY_SCOPES')
  const callbackUrl = `${getAppUrl(req)}/api/shopify/callback`

  const state = generateNonce(12)
  const redirectUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  redirectUrl.searchParams.set('client_id', clientId)
  redirectUrl.searchParams.set('scope', scopes)
  redirectUrl.searchParams.set('redirect_uri', callbackUrl)
  redirectUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(redirectUrl.toString())
  res.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}
