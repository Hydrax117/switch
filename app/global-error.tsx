'use client'

import { AlertTriangle } from 'lucide-react'

/**
 * global-error.tsx — handles errors in the root layout/template.
 * Must include its own <html> and <body> tags.
 * global-error bypasses the root layout, so we must import fonts/styles ourselves.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <head>
        <title>SWITCH — Something went wrong</title>
        <meta name="robots" content="noindex" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: ui-sans-serif, system-ui, sans-serif;
            background: #09090b;
            color: #fafafa;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .card {
            background: #111113;
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 2rem;
            max-width: 400px;
            width: 100%;
            text-align: center;
          }
          .icon { color: #ef4444; margin-bottom: 1rem; }
          h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
          p { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 1.5rem; }
          button {
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1.5rem;
            font-size: 0.875rem;
            cursor: pointer;
            width: 100%;
          }
          button:hover { background: #4338ca; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon" aria-hidden>
            <AlertTriangle size={40} style={{ margin: '0 auto' }} />
          </div>
          <h1>Critical error</h1>
          <p>
            A critical error occurred and the application could not load.
            {error.digest && ` (ID: ${error.digest})`}
          </p>
          <button onClick={() => retry()}>Try again</button>
        </div>
      </body>
    </html>
  )
}
