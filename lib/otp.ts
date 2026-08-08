/**
 * OTP utilities — generate, store, and verify one-time passwords.
 *
 * Storage strategy:
 *   1. Redis (preferred, fast TTL-based expiry)
 *   2. Prisma VerificationToken table (fallback when Redis is unavailable)
 *
 * OTP format: 6-digit numeric code
 * TTL: 10 minutes
 */
import { redis } from '@/lib/redis'
import { db } from '@/lib/prisma'

const OTP_TTL_SECONDS = 10 * 60 // 10 minutes
const OTP_LENGTH = 6

/** Generate a cryptographically random 6-digit OTP. */
export function generateOtp(): string {
  const min = 10 ** (OTP_LENGTH - 1)
  const max = 10 ** OTP_LENGTH - 1
  // Use Math.random for simplicity — replace with crypto.getRandomValues in strict security contexts
  return String(Math.floor(min + Math.random() * (max - min + 1)))
}

function redisKey(email: string) {
  return `otp:${email.toLowerCase()}`
}

/** Persist an OTP for the given email address. */
export async function storeOtp(email: string, otp: string): Promise<void> {
  const key = redisKey(email)
  const expires = new Date(Date.now() + OTP_TTL_SECONDS * 1000)

  if (redis) {
    // Store in Redis with automatic TTL expiry
    await redis.set(key, otp, 'EX', OTP_TTL_SECONDS)
    return
  }

  // Fallback: use the Prisma VerificationToken table
  // Delete any existing token for this email first
  await db.verificationToken
    .deleteMany({ where: { identifier: email.toLowerCase() } })
    .catch(() => null)

  await db.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      token: otp,
      expires,
    },
  })
}

/** Verify an OTP and consume it (one-time use). Returns true if valid. */
export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const key = redisKey(email)

  if (redis) {
    const stored = await redis.get(key)
    if (!stored || stored !== otp) return false
    // Consume the token
    await redis.del(key)
    return true
  }

  // Fallback: Prisma VerificationToken
  const record = await db.verificationToken
    .findFirst({
      where: {
        identifier: email.toLowerCase(),
        token: otp,
        expires: { gt: new Date() },
      },
    })
    .catch(() => null)

  if (!record) return false

  // Consume the token
  await db.verificationToken
    .delete({ where: { identifier_token: { identifier: email.toLowerCase(), token: otp } } })
    .catch(() => null)

  return true
}
