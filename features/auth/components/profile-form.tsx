'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input } from '@/components/ui'
import { Loader2, User } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  image: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface ProfileFormProps {
  userId: string
  /** Pre-filled values from an existing session */
  defaultValues?: Partial<FormValues>
}

export function ProfileForm({ userId, defaultValues }: ProfileFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      image: defaultValues?.image ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...values }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error ?? 'Failed to save profile.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Network error. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Display name{' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <div className="relative">
          <User className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className="pl-9"
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </div>
        {errors.name && (
          <p id="name-error" className="text-destructive text-xs" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Avatar URL (optional) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className="text-sm font-medium">
          Profile picture URL <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="image"
          type="url"
          autoComplete="photo"
          placeholder="https://example.com/avatar.jpg"
          aria-describedby={errors.image ? 'image-error' : undefined}
          aria-invalid={!!errors.image}
          {...register('image')}
        />
        {errors.image && (
          <p id="image-error" className="text-destructive text-xs" role="alert">
            {errors.image.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            'Save profile'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={isSubmitting}
        >
          Skip for now
        </Button>
      </div>
    </form>
  )
}
