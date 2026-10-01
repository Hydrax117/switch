'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * After hydration, scrolls to the element matching window.location.hash.
 * Needed because server-side redirects strip URL fragments, so the browser
 * can't scroll on initial paint — we do it once the page is hydrated.
 */
export function ScrollToHash() {
  const pathname = usePathname()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    // Small delay lets reveal animations / sticky headers settle
    const id = setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)

    return () => clearTimeout(id)
  }, [pathname])

  return null
}
