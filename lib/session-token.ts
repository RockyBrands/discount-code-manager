import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { upsertShopToken } from './shopify-session'

export interface ShopifySession {
  shop: string
  userId: string
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T
}

/**
 * Verifies a Shopify session token (JWT signed HS256 with the app secret)
 * from the Authorization header of an embedded-app request. Returns the
 * session, or a 401 NextResponse the route should return directly.
 */
export async function requireShopifySession(
  req: NextRequest,
): Promise<ShopifySession | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return unauthorized('Missing session token')
  }

  const secret = process.env.SHOPIFY_API_SECRET
  const apiKey = process.env.SHOPIFY_API_KEY
  if (!secret || !apiKey) {
    return NextResponse.json({ error: 'App credentials not configured' }, { status: 500 })
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return unauthorized('Malformed session token')
  }

  const [encodedHeader, encodedPayload, signature] = parts
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return unauthorized('Invalid session token signature')
  }

  let jwtHeader: { alg?: string }
  let payload: {
    iss?: string
    dest?: string
    aud?: string | string[]
    sub?: string
    exp?: number
    nbf?: number
  }
  try {
    jwtHeader = decodeSegment(encodedHeader)
    payload = decodeSegment(encodedPayload)
  } catch {
    return unauthorized('Malformed session token')
  }

  if (jwtHeader.alg !== 'HS256') {
    return unauthorized('Unexpected session token algorithm')
  }

  const now = Math.floor(Date.now() / 1000)
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(apiKey)) {
    return unauthorized('Session token audience mismatch')
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    return unauthorized('Session token expired')
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    return unauthorized('Session token not yet valid')
  }

  let shop: string
  try {
    const destination = new URL(payload.dest || '')
    shop = destination.hostname.toLowerCase()
    if (destination.protocol !== 'https:' || destination.port ||
        !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      return unauthorized('Invalid session token destination')
    }
  } catch {
    return unauthorized('Session token missing dest')
  }

  const iss = (payload.iss || '').toLowerCase()
  if (iss !== `https://${shop}/admin`) {
    return unauthorized('Session token issuer mismatch')
  }

  const installed = await prisma.shop.findUnique({
    where: { shopDomain: shop },
    select: { uninstalledAt: true },
  })
  if (!installed || installed.uninstalledAt) {
    const exchange = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      cache: 'no-store',
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: secret,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: token,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
        expiring: '0',
      }),
    })
    if (!exchange.ok) {
      console.error('Shopify token exchange rejected:', exchange.status)
      return NextResponse.json(
        { error: 'Unable to connect this installation. Reopen the app in Shopify admin and try again.' },
        { status: exchange.status === 400 ? 401 : 502 }
      )
    }
    const credentials = await exchange.json()
    if (typeof credentials.access_token !== 'string' || !credentials.access_token) {
      return NextResponse.json({ error: 'Shopify returned no installation token' }, { status: 502 })
    }
    await upsertShopToken(shop, credentials.access_token, credentials.scope)
  }

  return { shop, userId: payload.sub || '' }
}

/** Returns the session or sends the NextResponse (401). Use in route handlers. */
export async function getSessionOr401(req: NextRequest) {
  const result = await requireShopifySession(req)
  if (result instanceof NextResponse) {
    return { session: null, response: result }
  }
  return { session: result, response: null }
}
