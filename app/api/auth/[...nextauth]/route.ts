import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { NextAuthOptions } from 'next-auth'
import { ALLOWED_DOMAINS } from '@/lib/constants'

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user?.email) {
        const domain = user.email.split('@')[1]
        if (ALLOWED_DOMAINS.includes(domain)) {
          return true
        }
        return false
      }
      return false
    },
    async jwt({ token, user }) {
      if (user) {
        token.domain = user.email?.split('@')[1]
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.domain = token.domain as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
