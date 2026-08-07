'use client'

/**
 * Root Providers composition.
 *
 * Wraps the entire app. Add new providers here so that app/layout.tsx
 * remains clean and each provider can be tested in isolation.
 */
import type { ReactNode } from 'react'
import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>{children}</QueryProvider>
    </ThemeProvider>
  )
}
