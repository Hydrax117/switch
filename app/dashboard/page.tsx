import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { deleteSession } from '@/lib/session'

async function logout() {
  'use server'
  await deleteSession()
  redirect('/login')
}

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) redirect('/login')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="space-y-2 text-center">
        <h1 className="text-foreground text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground text-sm">{session.email}</p>
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
