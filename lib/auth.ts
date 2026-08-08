/**
 * Auth.js v5 configuration.
 *
 * Strategy: email OTP (magic-code) via a custom Credentials provider.
 * The actual OTP generation + email sending is handled by:
 *   POST /api/auth/send-otp   — request a code
 *   POST /api/auth/verify-otp — verify + upsert user
 *
 * Auth.js is used here purely for session management after the OTP is verified.
 */
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/prisma'
import { verifyOtp } from '@/lib/otp'

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: 'email-otp',
      name: 'Email OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'Code', type: 'text' },
        action: { label: 'Action', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const otp = credentials?.otp as string | undefined

        if (!email || !otp) return null

        const valid = await verifyOtp(email, otp)
        if (!valid) return null

        // Upsert the user so sign-up creates, sign-in finds
        const user = await db.user.upsert({
          where: { email: email.toLowerCase() },
          create: { email: email.toLowerCase(), emailVerified: new Date() },
          update: { emailVerified: new Date() },
        })

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },

  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
})
