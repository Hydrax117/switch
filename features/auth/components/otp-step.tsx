'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui'
import { Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OtpStepProps {
  email: string
  action: 'sign-in' | 'sign-up'
  onSuccess: (userId: string, isNewUser: boolean) => void
  onBack: () => void
}

const OTP_LENGTH = 6

export function OtpStep({ email, action, onSuccess, onBack }: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCountdown <= 0) return
    const id = setTimeout(() => setResendCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCountdown])

  function handleChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError(null)

    // Move focus forward
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (digit && next.every((d) => d !== '')) {
      void submitOtp(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((d, i) => {
      next[i] = d
    })
    setDigits(next)
    setError(null)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
    if (pasted.length === OTP_LENGTH) void submitOtp(pasted)
  }

  async function submitOtp(otp: string) {
    setIsVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Invalid code. Please try again.')
        setDigits(Array(OTP_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
        return
      }
      onSuccess(data.userId, data.isNewUser)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    setIsResending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to resend. Please try again.')
        return
      }
      setDigits(Array(OTP_LENGTH).fill(''))
      setResendCountdown(60)
      inputRefs.current[0]?.focus()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const otp = digits.join('')
  const canSubmit = otp.length === OTP_LENGTH && !isVerifying

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>
        </p>
      </div>

      {/* OTP Digit Inputs */}
      <div className="flex justify-center gap-3" role="group" aria-label="One-time password">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            className={cn(
              'border-border bg-surface focus:ring-brand-500 h-12 w-11 rounded-md border text-center text-lg font-semibold',
              'focus:ring-2 focus:ring-offset-2 focus:outline-none',
              'transition-colors',
              error && 'border-destructive',
              digit && 'border-brand-500'
            )}
            disabled={isVerifying}
          />
        ))}
      </div>

      {error && (
        <p
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-center text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Manual submit (auto-submits on last digit too) */}
      <Button onClick={() => submitOtp(otp)} disabled={!canSubmit} className="w-full">
        {isVerifying ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Verifying...
          </>
        ) : (
          'Verify code'
        )}
      </Button>

      {/* Resend & Back */}
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Change email
        </button>

        {resendCountdown > 0 ? (
          <p className="text-muted-foreground">Resend in {resendCountdown}s</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-brand-600 hover:text-brand-700 font-medium transition-colors disabled:opacity-50"
          >
            {isResending ? 'Resending...' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  )
}
