/**
 * Prisma Client singleton.
 *
 * The generated client lives at app/generated/prisma.
 * Run `npm run db:generate` once your DATABASE_URL is set.
 *
 * In development, Next.js hot-reloads modules on every save, which would
 * create a new PrismaClient each time and exhaust the connection pool.
 * We store the instance on `globalThis` to survive hot reloads.
 *
 * Usage:
 *   import { db } from '@/lib/prisma'
 *   const users = await db.user.findMany()
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any

declare global {
  // Prevents multiple instances during hot reload

  var __db: AnyPrismaClient | undefined
}

function createClient(): AnyPrismaClient {
  try {
    // Dynamic require so the module error is deferred until runtime,
    // allowing tsc to pass before the client is generated.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('../app/generated/prisma')
    return new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? (['query', 'error', 'warn'] as const)
          : (['error'] as const),
    })
  } catch {
    // Client not generated yet — a no-op proxy is returned so imports
    // don't throw at module load time.
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
}

export const db: AnyPrismaClient = globalThis.__db ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db
}

// Also export as `prisma` for teams that prefer that convention
export const prisma = db
