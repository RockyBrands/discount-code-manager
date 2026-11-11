import { NextRequest, NextResponse } from 'next/server'

// Authentication lives in the route handlers: embedded-app requests carry a
// Shopify session token (verified in lib/session-token.ts), webhooks verify
// HMAC, and internal routes use INTERNAL_SHARED_SECRET. Middleware only
// forwards top-level install hits (/?shop&hmac) into the OAuth flow.
export function middleware(req: NextRequest) {
  const { searchParams } = req.nextUrl

  if (searchParams.get('shop') && searchParams.get('hmac')) {
    const installUrl = new URL('/api/shopify/auth', req.url)
    installUrl.searchParams.set('shop', searchParams.get('shop') as string)
    return NextResponse.redirect(installUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
