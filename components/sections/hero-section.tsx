'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { EventListItem } from '@/features/events/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  events: EventListItem[]
  categories: { id: string; name: string; slug: string }[]
}

// ─── Poster config — positional slots around the central copy ────────────────
// Each slot defines: which event index to pull, size class, position, optional rotation
// Positions are absolute within the full-bleed hero container

interface PosterSlot {
  eventIndex: number
  /** CSS width in px */
  w: number
  /** CSS height in px */
  h: number
  /** Tailwind/inline position classes */
  className: string
  rotation?: string
  priority?: boolean
}

const DESKTOP_SLOTS: PosterSlot[] = [
  // Far left — tall, slightly rotated
  { eventIndex: 0, w: 220, h: 290, className: 'hidden lg:block absolute left-[3%] top-[12%]', rotation: '-1.5deg', priority: true },
  // Left middle — smaller, offset lower
  { eventIndex: 1, w: 160, h: 210, className: 'hidden lg:block absolute left-[16%] top-[42%]', rotation: '1deg' },
  // Left-center — medium
  { eventIndex: 2, w: 185, h: 245, className: 'hidden xl:block absolute left-[28%] top-[8%]', rotation: '-0.8deg' },
  // Right-center — medium, mirror left
  { eventIndex: 3, w: 185, h: 245, className: 'hidden xl:block absolute right-[28%] top-[10%]', rotation: '0.8deg' },
  // Right middle — smaller
  { eventIndex: 4, w: 160, h: 210, className: 'hidden lg:block absolute right-[16%] top-[44%]', rotation: '-1deg' },
  // Far right — tall
  { eventIndex: 5, w: 220, h: 290, className: 'hidden lg:block absolute right-[3%] top-[10%]', rotation: '1.5deg', priority: true },
  // Bottom left accent
  { eventIndex: 6, w: 130, h: 170, className: 'hidden xl:block absolute left-[8%] bottom-[8%]', rotation: '1.2deg' },
  // Bottom right accent
  { eventIndex: 7, w: 130, h: 170, className: 'hidden xl:block absolute right-[8%] bottom-[6%]', rotation: '-1deg' },
]

const MOBILE_SLOTS: PosterSlot[] = [
  { eventIndex: 0, w: 130, h: 170, className: 'absolute left-[4%] bottom-[6%]', rotation: '-1.5deg' },
  { eventIndex: 1, w: 110, h: 145, className: 'absolute left-[38%] bottom-[4%]', rotation: '1deg' },
  { eventIndex: 2, w: 120, h: 158, className: 'absolute right-[4%] bottom-[7%]', rotation: '1.5deg' },
]

// ─── Individual poster ────────────────────────────────────────────────────────

function Poster({
  event,
  w,
  h,
  className,
  rotation = '0deg',
  priority = false,
  delay = 0,
}: PosterSlot & { event: EventListItem | undefined; delay?: number }) {
  const shouldReduce = useReducedMotion()

  if (!event) return null

  const style: React.CSSProperties = {
    width: w,
    height: h,
    transform: rotation !== '0deg' ? `rotate(${rotation})` : undefined,
    animationDelay: shouldReduce ? undefined : `${delay}ms`,
  }

  return (
    <div
      className={`${className} overflow-hidden rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.55)] poster-fade-in`}
      style={style}
      aria-hidden="true"
    >
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt=""
          width={w}
          height={h}
          className="h-full w-full object-cover object-center"
          sizes={`${w}px`}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : (
        <PosterFallback category={event.category?.name} color={event.category?.color} />
      )}
    </div>
  )
}

function PosterFallback({
  category,
  color,
}: {
  category?: string | null
  color?: string | null
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-4"
      style={{ backgroundColor: '#1a1a18' }}
    >
      <div className="h-px w-8 bg-white/20" />
      <p
        className="text-center font-semibold leading-none text-white/20"
        style={{ fontSize: '11px', letterSpacing: '0.15em' }}
      >
        {(category ?? 'SWITCH').toUpperCase()}
      </p>
      <div className="h-px w-8 bg-white/20" />
    </div>
  )
}

// ─── Hero section ─────────────────────────────────────────────────────────────

export function HeroSection({ events, categories }: HeroSectionProps) {
  const shouldReduce = useReducedMotion()

  return (
    <section
      className="relative min-h-svh overflow-hidden"
      style={{ backgroundColor: '#0D0D0D' }}
      aria-label="SWITCH — Discover events"
    >
      {/* ── Fine grain texture ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
          opacity: 0.028,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Vignette edges — softens the poster composition ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse 75% 80% at 50% 45%, transparent 30%, rgba(13,13,13,0.75) 100%)',
        }}
      />

      {/* ── Bottom fade into light content ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40"
        style={{
          background: 'linear-gradient(to bottom, transparent, #0D0D0D 70%, var(--background) 100%)',
        }}
      />

      {/* ── Desktop poster artwork ── */}
      {DESKTOP_SLOTS.map((slot, i) => (
        <Poster
          key={i}
          {...slot}
          event={events[slot.eventIndex]}
          delay={i * 60}
        />
      ))}

      {/* ── Mobile poster artwork (bottom strip) ── */}
      {MOBILE_SLOTS.map((slot, i) => (
        <Poster
          key={`m-${i}`}
          {...slot}
          event={events[slot.eventIndex]}
          delay={400 + i * 80}
          className={slot.className + ' lg:hidden'}
        />
      ))}

      {/* ── Central content ── */}
      <div
        className="relative z-[10] flex min-h-svh flex-col items-center justify-center px-5 pb-40 pt-28 sm:pb-48 sm:pt-32 lg:pb-32"
        style={{ textAlign: 'center' }}
      >
        {/* Brand wordmark */}
        <p
          className="hero-fade mb-8 text-[11px] font-semibold tracking-[0.22em] text-white/40 uppercase"
          style={{ animationDelay: shouldReduce ? undefined : '80ms' }}
        >
          SWITCH
        </p>

        {/* Headline */}
        <h1
          className="hero-fade mx-auto max-w-[14ch] font-semibold text-white"
          style={{
            fontSize: 'clamp(42px, 7vw, 80px)',
            lineHeight: 1.04,
            letterSpacing: '-0.04em',
            animationDelay: shouldReduce ? undefined : '160ms',
          }}
        >
          Something worth{' '}
          <span style={{ color: '#a5b4fc' }}>going to</span>
          {' '}is happening.
        </h1>

        {/* Sub-copy */}
        <p
          className="hero-fade mt-6 max-w-[36ch] text-[15px] leading-relaxed text-white/55 sm:text-[16px]"
          style={{ animationDelay: shouldReduce ? undefined : '240ms' }}
        >
          Concerts, comedy, culture, sports and more — all on SWITCH.
        </p>

        {/* CTAs */}
        <div
          className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: shouldReduce ? undefined : '320ms' }}
        >
          <Link
            href="/events"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore Events
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/dashboard/events/new"
            className="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/8 px-7 text-[14px] font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/14 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Create an Event
          </Link>
        </div>

        {/* Event count badge — only if we have real events */}
        {events.length > 0 && (
          <p
            className="hero-fade mt-8 text-[12px] text-white/30"
            style={{ animationDelay: shouldReduce ? undefined : '400ms' }}
          >
            {events.length}+ events happening soon
          </p>
        )}
      </div>
    </section>
  )
}
