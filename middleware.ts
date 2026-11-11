import { NextRequest, NextResponse } from 'next/server'

// Authentication lives in the route handlers: embedded-app requests carry a
// Shopify session token (verified in lib/session-token.ts), webhooks verify
// HMAC, and internal routes use INTERNAL_SHARED_SECRET. Middleware only
// forwards TOP-LEVEL install hits (/?shop&hmac) into the OAuth flow. Embedded
// iframe loads also arrive with shop&hmac but always carry `host`/`embedded` —
// they must NOT be bounced into OAuth, because the state cookie can't be set
// from inside a third-party iframe (OAuth must run top-level).
export function middleware(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const isEmbeddedLoad = searchParams.has('host') || searchParams.has('embedded') || searchParams.has('id_token')
  if (searchParams.get('shop') && searchParams.get('hmac') && !isEmbeddedLoad) {
    const installUrl = new URL('/api/shopify/auth', req.url)
    installUrl.searchParams.set('shop', searchParams.get('shop') as string)
    return NextResponse.redirect(installUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
