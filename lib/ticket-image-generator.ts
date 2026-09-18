/**
 * Server-side ticket image generation using Satori + resvg.
 *
 * Satori converts a JSX-like object tree to SVG.
 * @resvg/resvg-js renders the SVG to a PNG buffer.
 *
 * Both libraries are pure Node.js / WASM — no Chromium, works on Vercel.
 */
import 'server-only'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import QRCode from 'qrcode'

// ─── Ticket Data Type ─────────────────────────────────────────────────────────

export interface TicketData {
  ticketNumber: string
  qrCode: string
  eventTitle: string
  eventDate: Date
  eventVenue?: string
  ticketType: string
  seatLabel?: string | null
  ticketId?: string
  status?: 'ACTIVE' | 'USED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED'
}

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  dot: string
  text: string
  bg: string
  border: string
}

const STATUS: Record<string, StatusConfig> = {
  ACTIVE:    { label: 'Valid',      dot: '#10b981', text: '#059669', bg: '#f0fdf4', border: '#86efac' },
  USED:      { label: 'Used',       dot: '#a1a1aa', text: '#71717a', bg: '#f4f4f5', border: '#d4d4d8' },
  CANCELLED: { label: 'Cancelled',  dot: '#ef4444', text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  REFUNDED:  { label: 'Refunded',   dot: '#f59e0b', text: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  EXPIRED:   { label: 'Expired',    dot: '#a1a1aa', text: '#71717a', bg: '#f4f4f5', border: '#d4d4d8' },
}

// ─── Build the Satori element tree ───────────────────────────────────────────

async function buildTicketElement(ticket: TicketData) {
  const status = ticket.status ?? 'ACTIVE'
  const s = STATUS[status] ?? STATUS.ACTIVE

  const dateStr = ticket.eventDate.toLocaleDateString('en-NG', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const timeStr = ticket.eventDate.toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  // QR code as PNG data URL embedded in an <img>
  const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
    errorCorrectionLevel: 'M',
    width: 180,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const ticketId = (ticket.ticketId ?? ticket.qrCode).slice(0, 8).toUpperCase()

  // Satori uses React-like element objects (tw prop NOT needed — use style objects)
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: 380,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        fontFamily: 'sans-serif',
      },
      children: [
        // ── Header gradient ──────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              height: 160,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              padding: '0 20px 16px',
              position: 'relative',
            },
            children: [
              // Status badge
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    backgroundColor: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: 9999,
                    padding: '4px 10px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: 6, height: 6,
                          borderRadius: '50%',
                          backgroundColor: s.dot,
                        },
                        children: [],
                      },
                    },
                    {
                      type: 'span',
                      props: {
                        style: { fontSize: 10, fontWeight: 700, color: s.text, letterSpacing: '0.05em' },
                        children: [s.label],
                      },
                    },
                  ],
                },
              },
              // Event title
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 18, fontWeight: 700, color: '#ffffff',
                    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  },
                  children: [ticket.eventTitle],
                },
              },
            ],
          },
        },

        // ── Detail grid ──────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 14,
              padding: '16px 20px',
            },
            children: [
              field('Date', dateStr),
              field('Time', timeStr),
              ...(ticket.eventVenue ? [field('Venue', ticket.eventVenue, true)] : []),
              field('Type', ticket.ticketType),
              ...(ticket.seatLabel ? [field('Seat', ticket.seatLabel)] : []),
            ],
          },
        },

        // ── Ticket number strip ──────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              margin: '0 20px 16px',
              backgroundColor: '#f4f4f5',
              border: '1px solid #d4d4d8',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: 11,
              letterSpacing: '0.1em',
              color: '#71717a',
            },
            children: [
              { type: 'span', props: { style: {}, children: ['#'] } },
              { type: 'span', props: { style: {}, children: [ticket.ticketNumber] } },
            ],
          },
        },

        // ── Dashed separator ─────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              margin: '0 0 4px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    flex: 1,
                    height: 1,
                    margin: '0 20px',
                    borderTop: '1px dashed #d4d4d8',
                  },
                  children: [],
                },
              },
            ],
          },
        },

        // ── QR section ───────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 20px 24px',
              gap: 8,
              opacity: status === 'ACTIVE' ? 1 : 0.5,
            },
            children: [
              {
                type: 'img',
                props: {
                  src: qrDataUrl,
                  width: 180,
                  height: 180,
                  style: { borderRadius: 8 },
                },
              },
              {
                type: 'span',
                props: {
                  style: { fontSize: 11, color: '#71717a', letterSpacing: '0.05em' },
                  children: [status === 'ACTIVE' ? 'Scan at entrance' : 'Ticket invalid'],
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 9, color: '#d4d4d8', letterSpacing: '0.2em',
                    fontFamily: 'monospace', textTransform: 'uppercase',
                  },
                  children: [ticketId],
                },
              },
            ],
          },
        },
      ],
    },
  }
}

// ─── Helper: detail field ─────────────────────────────────────────────────────

function field(label: string, value: string, wide = false) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        ...(wide ? { width: '100%' } : { width: 'calc(50% - 7px)' }),
      },
      children: [
        {
          type: 'span',
          props: {
            style: {
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: '#a1a1aa', fontWeight: 600,
            },
            children: [label],
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: 13, color: '#27272a' },
            children: [value],
          },
        },
      ],
    },
  }
}

// ─── Generate ticket image as PNG buffer ──────────────────────────────────────

export async function generateTicketImage(ticket: TicketData): Promise<Buffer> {
  const element = await buildTicketElement(ticket)

  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: 380,
    height: 580,
    fonts: [], // no custom fonts — uses system sans-serif fallback
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 380 },
  })

  return Buffer.from(resvg.render().asPng())
}

// ─── Generate PNG images for multiple tickets ─────────────────────────────────

export async function generateTicketImages(
  tickets: TicketData[]
): Promise<Array<{ filename: string; content: Buffer; mimeType: string }>> {
  const results = await Promise.all(
    tickets.map(async (ticket) => {
      const content = await generateTicketImage(ticket)
      return {
        filename: `ticket-${ticket.ticketNumber}.png`,
        content,
        mimeType: 'image/png',
      }
    })
  )
  return results
}
