/**
 * Prisma Client singleton — Prisma 7 adapter-based setup.
 *
 * Prisma 7 removes the `url` field from the datasource block in schema.prisma.
 * The connection string is passed via the PrismaPg driver adapter instead.
 *
 * The instance is stored on `globalThis` to survive Next.js hot reloads in
 * development without exhausting the connection pool.
 *
 * Usage:
 *   import { db } from '@/lib/prisma'
 *   const users = await db.user.findMany()
 */
import { PrismaPg } from '@prisma/adapter-pg'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any

declare global {
  var __db: AnyPrismaClient | undefined
}

function createClient(): AnyPrismaClient {
  try {
    // Dynamic require defers the module error until runtime so tsc passes
    // before the client is generated (`npm run db:generate`).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('../app/generated/prisma')

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Client not generated yet — return a no-op proxy so imports don't throw
    // at module load time before `prisma generate` has run.
    if (message.includes('Cannot find module')) {
      return new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === '$connect' || prop === '$disconnect') {
              return () => Promise.resolve()
            }
            throw new Error(
              `[Prisma] Client not generated. Run \`npm run db:generate\` first. ` +
                `(Attempted to access: db.${String(prop)})`
            )
          },
        }
      )
    }
    throw err
  }
}

export const db: AnyPrismaClient = globalThis.__db ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db
}

// Also export as `prisma` for teams that prefer that convention
export const prisma = db
