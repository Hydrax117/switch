/**
 * Server-side ticket image generation using @vercel/og (Satori).
 *
 * Pure JS — no Chrome, no native binaries. Works on Vercel serverless
 * and locally. Generates PNG buffers suitable for email attachments.
 */
import 'server-only'
import QRCode from 'qrcode'
import { ImageResponse } from '@vercel/og'

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

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  ACTIVE:    { label: 'Valid',      dot: '#10b981', text: '#059669', bg: '#f0fdf4', border: '#86efac' },
  USED:      { label: 'Used',       dot: '#a1a1aa', text: '#71717a', bg: '#f4f4f5', border: '#d4d4d8' },
  CANCELLED: { label: 'Cancelled',  dot: '#ef4444', text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  REFUNDED:  { label: 'Refunded',   dot: '#f59e0b', text: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  EXPIRED:   { label: 'Expired',    dot: '#a1a1aa', text: '#71717a', bg: '#f4f4f5', border: '#d4d4d8' },
}

// ─── Generate ticket PNG buffer ───────────────────────────────────────────────

/**
 * Generates a 400×620 PNG of a ticket using @vercel/og (Satori).
 * Returns a Buffer suitable for email attachments.
 */
export async function generateTicketImage(ticket: TicketData): Promise<Buffer> {
  const status = ticket.status ?? 'ACTIVE'
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACTIVE!
  const isValid = status === 'ACTIVE'

  const dateStr = ticket.eventDate.toLocaleDateString('en-NG', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  const timeStr = ticket.eventDate.toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  // QR code as data URL embedded in the image
  const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
    errorCorrectionLevel: 'M',
    width: 180,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const shortId = (ticket.ticketId ?? ticket.qrCode).slice(0, 8).toUpperCase()

  // Satori expects React element objects — we use the tw-like inline style objects
  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: '400px',
        background: 'white',
        borderRadius: '24px',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
      },
      children: [
        // ── Header ──────────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              justifyContent: 'flex-end',
              height: '160px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              padding: '0 20px 16px',
              position: 'relative' as const,
            },
            children: [
              // Status badge
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'absolute' as const,
                    top: '14px',
                    right: '14px',
                    background: s.bg,
                    color: s.text,
                    border: `1px solid ${s.border}`,
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: s.dot, marginRight: '4px',
                        },
                      },
                    },
                    { type: 'span', props: { children: s.label } },
                  ],
                },
              },
              // Event title
              {
                type: 'div',
                props: {
                  style: {
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    lineHeight: '1.3',
                  },
                  children: ticket.eventTitle,
                },
              },
            ],
          },
        },

        // ── Details grid ────────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexWrap: 'wrap' as const,
              padding: '20px',
              gap: '16px',
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
              alignItems: 'center',
              margin: '0 20px 16px',
              background: 'rgba(244,244,245,0.8)',
              border: '1px solid rgba(212,212,212,0.8)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#71717a',
              letterSpacing: '0.1em',
            },
            children: `# ${ticket.ticketNumber}`,
          },
        },

        // ── Perforation line ─────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              margin: '4px 0',
              height: '1px',
              background: 'repeating-linear-gradient(90deg,#d4d4d8 0,#d4d4d8 4px,transparent 4px,transparent 8px)',
              marginLeft: '20px',
              marginRight: '20px',
            },
          },
        },

        // ── QR code section ──────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              padding: '20px 20px 28px',
              gap: '8px',
              opacity: isValid ? 1 : 0.4,
            },
            children: [
              {
                type: 'img',
                props: {
                  src: qrDataUrl,
                  width: 170,
                  height: 170,
                  style: { borderRadius: '8px' },
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '11px', color: '#71717a', letterSpacing: '0.05em' },
                  children: isValid ? 'Scan at entrance' : 'Ticket invalid',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: '#d4d4d8',
                    letterSpacing: '0.2em',
                    marginTop: '4px',
                  },
                  children: shortId,
                },
              },
            ],
          },
        },
      ],
    },
  }

  const imageResponse = new ImageResponse(element as Parameters<typeof ImageResponse>[0], {
    width: 400,
    height: 620,
  })

  // ImageResponse is a Web Response — read its body as ArrayBuffer then Buffer
  const arrayBuffer = await imageResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function field(label: string, value: string, wide = false) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
        width: wide ? '100%' : '45%',
      },
      children: [
        {
          type: 'span',
          props: {
            style: {
              fontSize: '10px',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.1em',
              color: '#a1a1aa',
              fontWeight: 'bold',
            },
            children: label,
          },
        },
        {
          type: 'span',
          props: {
            style: { fontSize: '13px', color: '#27272a' },
            children: value,
          },
        },
      ],
    },
  }
}

// ─── Generate multiple ticket images ─────────────────────────────────────────

/**
 * Generates PNG images for multiple tickets.
 * Returns an array of { filename, content, mimeType }.
 */
export async function generateTicketImages(
  tickets: TicketData[]
): Promise<Array<{ filename: string; content: Buffer; mimeType: string }>> {
  return Promise.all(
    tickets.map(async (ticket) => ({
      filename: `ticket-${ticket.ticketNumber}.png`,
      content: await generateTicketImage(ticket),
      mimeType: 'image/png',
    }))
  )
}
