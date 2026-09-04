import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getUpcomingEvents } from '@/features/events'
import { EventCard } from '@/features/events/components/event-card'
import { FeaturedEventCard } from '@/features/events/components/featured-event-card'

export async function EventsSection() {
  const events = await getUpcomingEvents(7)

  if (!events.length) return null

  const [first, ...rest] = events
  const hasHero = Boolean(first?.imageUrl)

  return (
    <section className="bg-background py-16 sm:py-20" aria-label="Worth checking out">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* ── Section header ── */}
        <div className="mb-9 flex items-baseline justify-between gap-4">
          <h2
            className="text-foreground font-semibold tracking-tight"
            style={{ fontSize: 'clamp(22px, 2.8vw, 28px)', letterSpacing: '-0.03em' }}
          >
            Worth checking out
          </h2>
          <Link
            href="/events"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium transition-colors"
          >
            All events
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* ── Editorial grid ── */}
        {hasHero ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Hero card — spans 2 columns */}
            <div className="lg:col-span-2">
              <FeaturedEventCard event={first!} />
            </div>

            {/* Right column — stacked pair */}
            <div className="flex flex-col gap-5">
              {rest.slice(0, 2).map((event, i) => (
                <EventCard key={event.id} event={event} index={i + 1} variant="compact" />
              ))}
            </div>

            {/* Bottom row — 3-col standard cards */}
            {rest.slice(2, 5).map((event, i) => (
              <EventCard key={event.id} event={event} index={i + 3} />
            ))}
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
