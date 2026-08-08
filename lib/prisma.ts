/**
 * Prisma Client singleton — Prisma 7 adapter-based setup.
 *
 * Uses a static import so Next.js bundler can resolve the module path
 * at build time. The PrismaPg driver adapter supplies the connection
 * string, replacing the removed datasource url field (Prisma 7, P1012).
 *
 * Usage:
 *   import { db } from '@/lib/prisma'
 *   const users = await db.user.findMany()
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/app/generated/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any

declare global {
  var __db: AnyPrismaClient | undefined
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
