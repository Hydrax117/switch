'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Calendar, MapPin, Tag, Hash, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TicketModal, type TicketModalData } from './ticket-modal'
import type { TicketWithDetails } from '../types'

interface TicketCardProps {
  ticket: TicketWithDetails
  className?: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string; bgColor: string }> = {
  ACTIVE: {
    label: 'Valid',
    className: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15 border-emerald-500/30',
  },
  USED: {
    label: 'Used',
    className: 'text-zinc-400',
    bgColor: 'bg-zinc-500/15 border-zinc-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/30',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'text-amber-400',
    bgColor: 'bg-amber-500/15 border-amber-500/30',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'text-zinc-400',
    bgColor: 'bg-zinc-500/15 border-zinc-500/30',
  },
}

export function TicketCard({ ticket, className }: TicketCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.ACTIVE
  const isValid = ticket.status === 'ACTIVE'

  const modalData: TicketModalData = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    qrCode: ticket.qrCode,
    status: ticket.status,
    issuedAt: ticket.issuedAt,
    ticketType: {
      name: ticket.ticketType.name,
      currency: ticket.ticketType.currency,
    },
    event: {
      title: ticket.event.title,
      slug: ticket.event.slug,
      imageUrl: ticket.event.imageUrl,
      startsAt: ticket.event.startsAt,
      venue: ticket.event.venue,
    },
    eventSeat: ticket.eventSeat,
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          'group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition-all duration-300',
          'hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10',
          'active:scale-95',
          className
        )}
      >
        {/* Background image with gradient overlay */}
        <div className="relative h-32 w-full bg-gradient-to-br from-violet-900/50 to-purple-900/50">
          {ticket.event.imageUrl && (
            <Image
              src={ticket.event.imageUrl}
              alt={ticket.event.title}
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />

          {/* Status badge - top right */}
          <div className="absolute top-3 right-3 z-10">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-semibold backdrop-blur-sm',
                statusCfg.bgColor,
                statusCfg.className
              )}
            >
              {statusCfg.label}
            </span>
          </div>

          {/* Event title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="line-clamp-2 text-left text-sm font-bold leading-snug text-white drop-shadow">
              {ticket.event.title}
            </p>
          </div>
        </div>

        {/* Details section */}
        <div className="space-y-2 px-3 py-3">
          {/* Event date & time */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{format(ticket.event.startsAt, 'MMM d, yyyy')}</span>
            <span className="text-zinc-600">·</span>
            <span>{format(ticket.event.startsAt, 'h:mm a')}</span>
          </div>

          {/* Venue */}
          {ticket.event.venue && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">
                {ticket.event.venue.name}, {ticket.event.venue.city}
              </span>
            </div>
          )}

          {/* Ticket type & seat */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span>{ticket.ticketType.name}</span>
            {ticket.eventSeat?.seat && (
              <>
                <span className="text-zinc-600">·</span>
                <span>Seat {ticket.eventSeat.seat.label}</span>
              </>
            )}
          </div>

          {/* Ticket number */}
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Hash className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-[11px] tracking-wider">
              {ticket.ticketNumber}
            </span>
          </div>
        </div>

        {/* Hover action - show QR icon */}
        <div className="absolute bottom-3 right-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400">
            <Ticket className="h-4 w-4" />
          </div>
        </div>
      </button>

      {/* Ticket modal */}
      <TicketModal ticket={modalData} open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
