import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

// Prisma 7 config files don't auto-load .env — load it explicitly
dotenv.config()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set in .env')

/**
 * Prisma 7 configuration.
 *
 * Uses DATABASE_URL (transaction pooler, port 6543) because the session-mode
 * port 5432 is unreachable from this network. For migrations we use
 * `db push` (no shadow DB needed) rather than `migrate dev`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
})
