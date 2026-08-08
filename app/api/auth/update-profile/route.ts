/**
 * PATCH /api/auth/update-profile
 *
 * Accepts { userId, name, image? }
 * Updates the user's profile fields.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/prisma'

const schema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(100),
  image: z.string().url().optional().or(z.literal('')),
})

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { userId, name, image } = result.data

    const user = await db.user.update({
      where: { id: userId },
      data: {
        name,
        ...(image ? { image } : {}),
      },
      select: { id: true, name: true, email: true, image: true, role: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[update-profile] Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
