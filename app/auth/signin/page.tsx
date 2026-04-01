'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access the Shopify Coupon Code Generator
          </p>
        </div>
        <div>
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Only authorized domains: rockybrands.com, lehigh.com, lehighoutfitters.com
          </p>
        </div>
      </div>
    </div>
  )
}
