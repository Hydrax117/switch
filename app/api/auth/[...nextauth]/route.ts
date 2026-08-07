/**
 * Auth.js (next-auth v5) catch-all route handler.
 * Exposes GET and POST handlers for all /api/auth/* paths.
 */
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
