'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Search } from 'lucide-react'

interface HeroSectionProps {
  categories: { id: string; name: string; slug: string }[]
}

export function HeroSection({ categories }: HeroSectionProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim()
    if (q) {
      router.push(`/events?search=${encodeURIComponent(q)}`)
    } else {
      router.push('/events')
    }
  }

  return (
    <section className="pt-[60px]" aria-label="Discover events">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="py-16 sm:py-20">
          {/* ── Headline ── */}
          <h1
            className="text-foreground max-w-[18ch] font-semibold"
            style={{
              fontSize: 'clamp(38px, 5.5vw, 64px)',
              lineHeight: 1.06,
              letterSpacing: '-0.04em',
            }}
          >
            Discover events worth going to.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-[42ch] text-[15px] leading-relaxed sm:text-[16px]">
            Concerts, comedy, culture, sports and more — all in one place.
          </p>

          {/* ── Search ── */}
          <form onSubmit={handleSearch} className="mt-8 max-w-[560px]" role="search">
            <div
              className="border-border bg-surface flex h-[52px] items-center gap-3 rounded-xl border px-4 transition-all duration-200"
              style={{
                boxShadow: focused
                  ? '0 0 0 2px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.07)'
                  : '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <Search
                className="text-muted-foreground h-4 w-4 shrink-0"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search events, artists, venues…"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-[14px] outline-none"
                aria-label="Search events"
              />
              <button
                type="submit"
                className="bg-foreground text-background shrink-0 rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                Search
              </button>
            </div>
          </form>

          {/* ── Category pills ── */}
          {categories.length > 0 && (
            <nav
              aria-label="Browse by category"
              className="mt-5 flex flex-wrap items-center gap-2"
            >
              <span className="text-muted-foreground text-[12px] font-medium">Browse:</span>
              {categories.slice(0, 7).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/events?category=${cat.slug}`}
                  className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/25 rounded-full border px-3.5 py-1 text-[12.5px] font-medium transition-colors duration-150"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/events"
                className="text-muted-foreground hover:text-foreground text-[12.5px] font-medium transition-colors"
              >
                All →
              </Link>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
