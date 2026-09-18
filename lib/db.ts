/**
 * Prisma Client Singleton
 *
 * Uses DATABASE_URL (transaction-mode pooler, port 6543) at runtime.
 * Transaction mode is required for serverless — it releases connections
 * immediately after each query, preventing pool exhaustion.
 *
 * DIRECT_URL (session-mode, port 5432) is only for prisma migrate CLI —
 * never for runtime queries.
 */
import 'server-only'
import { Pool } from 'pg'
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  // Create a pg.Pool explicitly — this avoids any URL parsing ambiguity
  // in the PrismaPg adapter and gives us full control over pool settings.
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
