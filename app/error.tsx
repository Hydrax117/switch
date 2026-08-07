'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry)
    console.error('[Error Boundary]:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="mt-4 text-center">Something went wrong</CardTitle>
          <CardDescription className="text-center">
            We encountered an unexpected error. Please try again.
          </CardDescription>
        </CardHeader>

        {process.env.NODE_ENV === 'development' && (
          <CardContent className="space-y-2 border-t pt-6">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error.message}</p>
            {error.digest && (
              <p className="text-muted-foreground text-xs">
                Error ID: <code className="bg-muted rounded px-1 py-0.5">{error.digest}</code>
              </p>
            )}
          </CardContent>
        )}

        <CardFooter className="flex flex-col gap-2">
          <Button onClick={() => retry()} className="w-full">
            Try again
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = '/')} className="w-full">
            Go to homepage
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
