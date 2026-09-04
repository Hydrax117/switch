import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function OrganizerCta() {
  return (
    <section className="border-border/60 border-t" aria-label="Create an event">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-foreground text-[18px] font-semibold tracking-tight sm:text-[20px]">
              Create an event
            </h2>
            <p className="text-muted-foreground mt-1.5 max-w-[38ch] text-[14px] leading-relaxed">
              Sell tickets and manage your attendees with SWITCH.
            </p>
          </div>
          <Link
            href="/dashboard/events/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-[13.5px] font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
