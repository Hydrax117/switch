import type { Metadata } from 'next'
import { AuthForm } from '@/features/auth'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="border-border bg-surface rounded-xl border p-8 shadow-sm">
          <AuthForm action="sign-up" />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <a
            href="/sign-in"
            className="text-brand-600 hover:text-brand-700 font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
