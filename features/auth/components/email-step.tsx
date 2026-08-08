'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input } from '@/components/ui'
import { Loader2, Mail } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

interface EmailStepProps {
  action: 'sign-in' | 'sign-up'
  onSuccess: (email: string) => void
}

export function EmailStep({ action, onSuccess }: EmailStepProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error ?? 'Failed to send code. Please try again.')
        return
      }
      onSuccess(values.email)
    } catch {
      setServerError('Network error. Please check your connection.')
    }
  }

  const heading = action === 'sign-up' ? 'Create your account' : 'Welcome back'
  const subheading =
    action === 'sign-up'
      ? "Enter your email and we'll send you a code to get started."
      : "Enter your email and we'll send you a sign-in code."

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{subheading}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-9"
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="text-destructive text-xs" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {serverError && (
          <p
            className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
            role="alert"
          >
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending code...
            </>
          ) : (
            'Send code'
          )}
        </Button>
      </form>
    </div>
  )
}
