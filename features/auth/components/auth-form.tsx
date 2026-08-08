'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmailStep } from './email-step'
import { OtpStep } from './otp-step'

type Step = 'email' | 'otp'

interface AuthFormProps {
  action: 'sign-in' | 'sign-up'
}

export function AuthForm({ action }: AuthFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  function handleEmailSuccess(submittedEmail: string) {
    setEmail(submittedEmail)
    setStep('otp')
  }

  function handleOtpSuccess(_userId: string, isNewUser: boolean) {
    if (isNewUser) {
      router.push('/profile/setup')
    } else {
      router.push('/dashboard')
    }
  }

  if (step === 'otp') {
    return (
      <OtpStep
        email={email}
        action={action}
        onSuccess={handleOtpSuccess}
        onBack={() => setStep('email')}
      />
    )
  }

  return <EmailStep action={action} onSuccess={handleEmailSuccess} />
}
