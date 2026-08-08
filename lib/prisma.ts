/**
 * Prisma Client singleton — Prisma 7 adapter-based setup.
 *
 * `server-only` ensures this module is never accidentally imported on the
 * client. The generated client uses import.meta.url and must run in Node.js.
 *
 * next.config.ts lists @prisma/client and @prisma/adapter-pg in
 * serverExternalPackages so Turbopack does not attempt to bundle them.
 *
 * Usage:
 *   import { db } from '@/lib/prisma'
 *   const users = await db.user.findMany()
 */
import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../app/generated/prisma/client'

declare global {
  var __db: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('[Prisma] DATABASE_URL environment variable is not set.')
  }

  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? (['query', 'error', 'warn'] as const)
        : (['error'] as const),
  })
}

export const db: PrismaClient = globalThis.__db ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db
}

// Also export as `prisma` for teams that prefer that convention
export const prisma = db
