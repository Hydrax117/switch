'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/shared/theme-toggle'

// ΓöÇΓöÇΓöÇ Logo mark ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect width="22" height="22" rx="6" fill="currentColor" className="text-brand-600" />
      <path
        d="M6 11.5L10 7l6 8"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false)
  }, [pathname])

  return (
    <header
      ref={headerRef}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/90 border-border/60 border-b shadow-[0_1px_0_0_var(--border)] backdrop-blur-xl'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between px-5 sm:px-8">
        {/* ΓöÇΓöÇ Logo ΓöÇΓöÇ */}
        <Link
          href="/"
          className="text-foreground flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">{siteConfig.name}</span>
        </Link>

        {/* ΓöÇΓöÇ Desktop Nav ΓöÇΓöÇ */}
        <nav className="hidden items-center gap-0.5 md:flex" role="navigation">
          {siteConfig.mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative rounded-md px-3.5 py-2 text-[13.5px] font-medium transition-colors',
                'hover:text-foreground',
                pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.title}
              {pathname === item.href && (
                <motion.span
                  layoutId="nav-indicator"
                  className="bg-foreground/60 absolute inset-x-1.5 -bottom-px h-px rounded-full"
                />
              )}
            </Link>
          ))}
        </nav>

        {/* ΓöÇΓöÇ Actions ΓöÇΓöÇ */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <div className="hidden items-center gap-1.5 md:flex">
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-foreground rounded-md px-3.5 py-2 text-[13.5px] font-medium transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                'inline-flex items-center rounded-lg px-4 py-2 text-[13.5px] font-medium',
                'bg-foreground text-background',
                'transition-all duration-200 hover:opacity-85',
                'focus-visible:outline-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
              )}
            >
              Get started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-md transition-colors md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* ΓöÇΓöÇ Mobile Nav ΓöÇΓöÇ */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="border-border/60 bg-background/95 border-t backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto max-w-[1120px] px-5 pt-3 pb-6 sm:px-8">
              <nav className="flex flex-col gap-0.5">
                {siteConfig.mainNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {item.title}
                  </Link>
                ))}
              </nav>
              <div className="border-border/60 mt-5 flex flex-col gap-2 border-t pt-5">
                <Link
                  href="/sign-in"
                  className="border-border hover:bg-muted rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="bg-foreground text-background rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-85"
                >
                  Get started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
