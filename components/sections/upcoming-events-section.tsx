import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getUpcomingEvents } from '@/features/events/queries'
import { UpcomingEventsClient } from './upcoming-events-client'

/**
 * Server component — fetches real published events and passes them to the
 * client component for animation. Links use event.slug so every event is
 * reachable and checkout works correctly.
 */
export async function UpcomingEventsSection() {
  const events = await getUpcomingEvents(6)

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* ── Header ── */}
        <div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-brand-500 inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.1em] uppercase">
              <span className="bg-brand-500/60 h-px w-5" />
              Upcoming Events
            </span>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
              What&apos;s happening near you
            </h2>
            <p className="text-muted-foreground mt-3 max-w-[440px] text-[15px] leading-[1.7]">
              From live concerts to tech summits — handpicked events across Nigeria, updated weekly.
            </p>
          </div>

          <Link
            href="/events"
            className="group border-border bg-surface text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition-all duration-200"
          >
            View all events
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="border-border bg-surface flex flex-col items-center justify-center rounded-2xl border py-20 text-center">
            <p className="text-[16px] font-semibold">No upcoming events yet</p>
            <p className="text-muted-foreground mt-1.5 text-[14px]">Check back soon.</p>
          </div>
        ) : (
          <UpcomingEventsClient events={events} />
        )}

        {/* ── Bottom CTA strip ── */}
        <div className="border-border bg-surface mt-10 flex items-center justify-center gap-4 rounded-2xl border px-6 py-5">
          <div className="text-muted-foreground flex items-center gap-2.5 text-[13.5px]">
            <span className="relative flex h-2 w-2">
              <span className="bg-brand-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
              <span className="bg-brand-400 relative inline-flex h-2 w-2 rounded-full" />
            </span>
            <span>
              <strong className="text-foreground font-semibold">{events.length}+</strong> events
              available now
            </span>
          </div>
          <div className="bg-border hidden h-4 w-px sm:block" />
          <Link
            href="/events"
            className="group text-brand-500 hidden items-center gap-1.5 text-[13.5px] font-medium transition-opacity hover:opacity-80 sm:inline-flex"
          >
            Browse all
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
