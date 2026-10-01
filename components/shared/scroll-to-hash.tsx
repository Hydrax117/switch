'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Reads the `_scroll` query param after login redirects and scrolls to the
 * matching element, then cleans up the param from the URL.
 *
 * Why a query param instead of a hash fragment:
 * HTTP 302 redirects strip the URL fragment before the request is sent, so
 * server-side redirect() can't carry a hash to the browser. Using _scroll as
 * a regular param survives the redirect chain.
 */
export function ScrollToHash() {
  const searchParams = useSearchParams()
  const scrollTarget = searchParams.get('_scroll')

  useEffect(() => {
    if (!scrollTarget) return

    // Small delay lets page layout, reveal animations, and sticky headers settle
    const id = setTimeout(() => {
      const el = document.getElementById(scrollTarget)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      // Clean up the _scroll param from the URL so it doesn't persist on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('_scroll')
      window.history.replaceState(null, '', url.toString())
    }, 150)

    return () => clearTimeout(id)
  }, [scrollTarget])

  return null
}
