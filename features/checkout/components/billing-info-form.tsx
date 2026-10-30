'use client'

import { cn } from '@/lib/utils'

export interface BillingInfo {
  firstName: string
  lastName: string
  phone: string
  email: string
  country: string
}

interface BillingInfoFormProps {
  value: BillingInfo
  onChange: (value: BillingInfo) => void
  errors?: Partial<Record<keyof BillingInfo, string>>
  disabled?: boolean
}

const COUNTRIES = [
  'Nigeria',
  'Ghana',
  'Kenya',
  'South Africa',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'UAE',
  'Other',
]

export function BillingInfoForm({ value, onChange, errors, disabled }: BillingInfoFormProps) {
  function set(field: keyof BillingInfo) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({ ...value, [field]: e.target.value })
    }
  }

  return (
    <div className="border-border rounded-2xl border p-5">
      <h2 className="mb-5 text-[16px] font-semibold">Billing information</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* First Name */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.firstName}
            onChange={set('firstName')}
            disabled={disabled}
            autoComplete="given-name"
            className={cn(
              'border-border bg-background w-full rounded-lg border px-3 py-2.5 text-[13.5px]',
              'placeholder:text-muted-foreground focus:border-brand-500 focus:ring-brand-500/30 outline-none focus:ring-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errors?.firstName && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
            )}
            placeholder="John"
          />
          {errors?.firstName && (
            <p className="mt-1 text-[11.5px] text-red-500">{errors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.lastName}
            onChange={set('lastName')}
            disabled={disabled}
            autoComplete="family-name"
            className={cn(
              'border-border bg-background w-full rounded-lg border px-3 py-2.5 text-[13.5px]',
              'placeholder:text-muted-foreground focus:border-brand-500 focus:ring-brand-500/30 outline-none focus:ring-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errors?.lastName && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
            )}
            placeholder="Doe"
          />
          {errors?.lastName && (
            <p className="mt-1 text-[11.5px] text-red-500">{errors.lastName}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={value.phone}
            onChange={set('phone')}
            disabled={disabled}
            autoComplete="tel"
            className={cn(
              'border-border bg-background w-full rounded-lg border px-3 py-2.5 text-[13.5px]',
              'placeholder:text-muted-foreground focus:border-brand-500 focus:ring-brand-500/30 outline-none focus:ring-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errors?.phone && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
            )}
            placeholder="+234 800 000 0000"
          />
          {errors?.phone && (
            <p className="mt-1 text-[11.5px] text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={value.email}
            onChange={set('email')}
            disabled={disabled}
            autoComplete="email"
            className={cn(
              'border-border bg-background w-full rounded-lg border px-3 py-2.5 text-[13.5px]',
              'placeholder:text-muted-foreground focus:border-brand-500 focus:ring-brand-500/30 outline-none focus:ring-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errors?.email && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
            )}
            placeholder="john@example.com"
          />
          {errors?.email && (
            <p className="mt-1 text-[11.5px] text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Country */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[13px] font-medium">
            Country <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={value.country}
              onChange={set('country')}
              disabled={disabled}
              autoComplete="country-name"
              className={cn(
                'border-border bg-background w-full appearance-none rounded-lg border px-3 py-2.5 text-[13.5px]',
                'focus:border-brand-500 focus:ring-brand-500/30 outline-none focus:ring-1',
                'disabled:cursor-not-allowed disabled:opacity-50',
                errors?.country && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
              )}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {/* chevron */}
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg
                className="text-muted-foreground h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
          {errors?.country && (
            <p className="mt-1 text-[11.5px] text-red-500">{errors.country}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Validate billing info and return field errors (empty object = valid). */
export function validateBillingInfo(
  info: BillingInfo
): Partial<Record<keyof BillingInfo, string>> {
  const errors: Partial<Record<keyof BillingInfo, string>> = {}

  if (!info.firstName.trim()) errors.firstName = 'First name is required'
  if (!info.lastName.trim()) errors.lastName = 'Last name is required'
  if (!info.phone.trim()) errors.phone = 'Phone number is required'
  if (!info.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!info.country.trim()) errors.country = 'Country is required'

  return errors
}
