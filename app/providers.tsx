'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>
    }
  }
}

/**
 * Embedded-app shell. App Bridge (loaded via the CDN script + api-key meta tag
 * in layout.tsx) exposes `window.shopify.idToken()`, which returns a session
 * token JWT. This provider attaches that token to every same-origin /api fetch
 * so API routes can authenticate the staff member.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shop = params.get('shop')
    const host = params.get('host')

    if (!shop) {
      setBlocked(true)
      return
    }

    // Missing host means we're not inside Shopify admin (or params were lost).
    // Bounce the top frame through OAuth, which returns with full params.
    if (!host) {
      window.top!.location.href = `/api/shopify/auth?shop=${encodeURIComponent(shop)}`
      return
    }

    const originalFetch = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      const isLocalApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
      if (!isLocalApi || !window.shopify?.idToken) {
        return originalFetch(input, init)
      }
      try {
        const token = await window.shopify.idToken()
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
        headers.set('Authorization', `Bearer ${token}`)
        return originalFetch(input, { ...init, headers })
      } catch {
        return originalFetch(input, init)
      }
    }

    const bridgeTimeout = window.setTimeout(() => setBlocked(true), 15000)
    const waitForBridge = window.setInterval(() => {
      if (window.shopify?.idToken) {
        setReady(true)
        window.clearTimeout(bridgeTimeout)
        window.clearInterval(waitForBridge)
      }
    }, 100)

    return () => {
      window.clearTimeout(bridgeTimeout)
      window.clearInterval(waitForBridge)
      window.fetch = originalFetch
    }
  }, [])

  if (blocked) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h4">Open this app from Shopify admin</h1>
        <p className="text-muted">
          This app is embedded in Shopify. Launch it from the Apps section of a
          store&apos;s admin where it is installed.
        </p>
      </div>
    )
  }

  if (!ready) return <div className="container py-5 text-muted">Connecting to Shopify…</div>

  return children
}
