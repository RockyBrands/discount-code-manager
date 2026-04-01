'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CouponGeneratorBootstrap } from '@/components/coupon-generator-bootstrap'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-light">
      <header className="bg-white shadow-sm border-bottom">
        <div className="container mx-auto px-4">
          <div className="d-flex justify-content-between align-items-center py-4">
            <div>
              <h1 className="h3 mb-1">
                Shopify Coupon Code Generator
              </h1>
              <p className="text-muted small">
                Rocky Brands Family of Companies
              </p>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted small">
                {session.user?.email}
              </span>
              <button
                onClick={() => router.push('/api/auth/signout')}
                className="btn btn-primary"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container my-4">
        <CouponGeneratorBootstrap />
      </main>
    </div>
  )
}
