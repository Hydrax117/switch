/**
 * Server-side ticket image generation using Handlebars templates.
 *
 * Generates PNG images of tickets using Handlebars for templating
 * and qrcode library for generating QR codes.
 * These PNGs can be attached to emails or downloaded directly.
 */
import 'server-only'
import QRCode from 'qrcode'
import Handlebars from 'handlebars'

// ─── Handlebars Template for Ticket HTML ──────────────────────────────────────

const TICKET_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Ticket - {{ticketNumber}}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f3f4f6;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }

    .ticket-container {
      width: 360px;
      background: white;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 25px rgba(0,0,0,0.1);
    }

    .ticket-header {
      position: relative;
      height: 165px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .ticket-header::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.2), transparent);
      pointer-events: none;
    }

    .ticket-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: rgba(255,255,255,0.3);
      z-index: 10;
    }

    .status-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: {{statusBgColor}};
      color: {{statusTextColor}};
      border: 1px solid {{statusBorderColor}};
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.05em;
      backdrop-filter: blur(8px);
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: {{statusDotColor}};
    }

    .ticket-title {
      position: relative;
      z-index: 15;
      padding: 0 20px 16px;
      font-size: 17px;
      font-weight: bold;
      line-height: 1.3;
      color: white;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .ticket-details {
      padding: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .ticket-detail-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ticket-detail-field.wide {
      grid-column: 1 / -1;
    }

    .ticket-detail-label {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a1a1aa;
      font-weight: 600;
    }

    .ticket-detail-value {
      font-size: 13px;
      color: #27272a;
    }

    .ticket-number-strip {
      margin: 0 20px 16px;
      background: rgba(244, 244, 245, 0.8);
      border: 1px solid rgba(212, 212, 212, 0.8);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 0.12em;
      color: #71717a;
    }

    .ticket-perforation {
      position: relative;
      margin: 16px 0;
      display: flex;
      align-items: center;
    }

    .perforation-notch {
      position: absolute;
      width: 28px;
      height: 28px;
      background: #f3f4f6;
      border-radius: 50%;
      z-index: 10;
    }

    .perforation-notch.left {
      left: -14px;
    }

    .perforation-notch.right {
      right: -14px;
    }

    .perforation-line {
      width: 100%;
      height: 1px;
      background-image: repeating-linear-gradient(90deg, #d4d4d8 0, #d4d4d8 4px, transparent 4px, transparent 8px);
      margin: 0 20px;
    }

    .ticket-qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px 24px;
    }

    .ticket-qr-frame {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 24px;
      {{#unless isValid}}opacity: 0.5; filter: grayscale(100%);{{/unless}}
    }

    .ticket-qr-image {
      width: 170px;
      height: 170px;
      border-radius: 8px;
      image-rendering: pixelated;
    }

    .ticket-qr-label {
      font-size: 11px;
      color: #71717a;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    .ticket-id {
      margin-top: 12px;
      font-family: 'Courier New', monospace;
      font-size: 9px;
      letter-spacing: 0.2em;
      color: #d4d4d8;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    <!-- Header with event image and title -->
    <div class="ticket-header">
      <div class="status-badge">
        <span class="status-dot"></span>
        {{statusLabel}}
      </div>
      <div class="ticket-title">{{eventTitle}}</div>
    </div>

    <!-- Event Details -->
    <div class="ticket-details">
      <div class="ticket-detail-field">
        <span class="ticket-detail-label">Date</span>
        <span class="ticket-detail-value">{{eventDate}}</span>
      </div>
      <div class="ticket-detail-field">
        <span class="ticket-detail-label">Time</span>
        <span class="ticket-detail-value">{{eventTime}}</span>
      </div>
      {{#if eventVenue}}
        <div class="ticket-detail-field wide">
          <span class="ticket-detail-label">Venue</span>
          <span class="ticket-detail-value">{{eventVenue}}</span>
        </div>
      {{/if}}
      <div class="ticket-detail-field">
        <span class="ticket-detail-label">Type</span>
        <span class="ticket-detail-value">{{ticketType}}</span>
      </div>
      {{#if seatLabel}}
        <div class="ticket-detail-field">
          <span class="ticket-detail-label">Seat</span>
          <span class="ticket-detail-value">{{seatLabel}}</span>
        </div>
      {{/if}}
    </div>

    <!-- Ticket Number -->
    <div class="ticket-number-strip">
      <span>#</span>
      <span>{{ticketNumber}}</span>
    </div>

    <!-- Perforation Line -->
    <div class="ticket-perforation">
      <div class="perforation-notch left"></div>
      <div class="perforation-line"></div>
      <div class="perforation-notch right"></div>
    </div>

    <!-- QR Code Section -->
    <div class="ticket-qr-section">
      <div class="ticket-qr-frame">
        <img src="{{qrCodeDataUrl}}" alt="Ticket QR code" class="ticket-qr-image" />
        <div class="ticket-qr-label">{{#if isValid}}Scan at entrance{{else}}Ticket invalid{{/if}}</div>
      </div>
      <div class="ticket-id">{{ticketId}}</div>
    </div>
  </div>
</body>
</html>
`

// ─── Status Configuration ─────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  dotColor: string
  textColor: string
  bgColor: string
  borderColor: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  ACTIVE: {
    label: 'Valid',
    dotColor: '#10b981',
    textColor: '#059669',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  USED: {
    label: 'Used',
    dotColor: '#a1a1aa',
    textColor: '#71717a',
    bgColor: '#f4f4f5',
    borderColor: '#d4d4d8',
  },
  CANCELLED: {
    label: 'Cancelled',
    dotColor: '#ef4444',
    textColor: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  REFUNDED: {
    label: 'Refunded',
    dotColor: '#f59e0b',
    textColor: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  EXPIRED: {
    label: 'Expired',
    dotColor: '#a1a1aa',
    textColor: '#71717a',
    bgColor: '#f4f4f5',
    borderColor: '#d4d4d8',
  },
}

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

// ─── Compile Handlebars Template (singleton) ──────────────────────────────────

let _compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null

function getCompiledTemplate() {
  if (!_compiledTemplate) {
    _compiledTemplate = Handlebars.compile(TICKET_TEMPLATE)
  }
  return _compiledTemplate
}

// ─── Generate Ticket HTML from Data ───────────────────────────────────────────

async function generateTicketHtml(ticket: TicketData): Promise<string> {
  const status = ticket.status ?? 'ACTIVE'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACTIVE
  const isValid = status === 'ACTIVE'

  // Format date and time
  const dateStr = ticket.eventDate.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const timeStr = ticket.eventDate.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(ticket.qrCode, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  // Prepare template context
  const context = {
    ticketNumber: ticket.ticketNumber,
    ticketId: (ticket.ticketId ?? ticket.qrCode).slice(0, 8).toUpperCase(),
    eventTitle: ticket.eventTitle,
    eventDate: dateStr,
    eventTime: timeStr,
    eventVenue: ticket.eventVenue,
    ticketType: ticket.ticketType,
    seatLabel: ticket.seatLabel,
    qrCodeDataUrl,
    isValid,
    statusLabel: statusCfg.label,
    statusDotColor: statusCfg.dotColor,
    statusTextColor: statusCfg.textColor,
    statusBgColor: statusCfg.bgColor,
    statusBorderColor: statusCfg.borderColor,
  }

  // Render template
  const template = getCompiledTemplate()
  return template(context)
}

// ─── Generate ticket image as PNG buffer ──────────────────────────────────────

/**
 * Generates a PNG image of a ticket using Handlebars template.
 * Returns a buffer that can be saved to disk or attached to an email.
 *
 * The process:
 * 1. Render Handlebars template with ticket data
 * 2. Generate QR code as PNG data URL
 * 3. Convert HTML to PNG using html-to-image
 * 4. Return as buffer
 */
export async function generateTicketImage(ticket: TicketData): Promise<Buffer> {
  try {
    // Generate HTML using Handlebars
    const html = await generateTicketHtml(ticket)

    // Dynamic import of html-to-image (heavy dependency)
    const { toPng } = await import('html-to-image')

    // Create temporary container for rendering
    const container = typeof document !== 'undefined'
      ? document.createElement('div')
      : null

    if (container) {
      container.innerHTML = html
      document.body.appendChild(container)

      try {
        // Convert HTML to PNG
        const pngDataUrl = await toPng(container, {
          cacheBust: true,
          pixelRatio: 2,
        })

        // Convert data URL to buffer
        const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, '')
        return Buffer.from(base64, 'base64')
      } finally {
        document.body.removeChild(container)
      }
    }

    // Fallback for Node.js environment (server-side)
    // Return QR code only as PNG
    const qrPngBuffer = await QRCode.toBuffer(ticket.qrCode, {
      errorCorrectionLevel: 'M',
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    return qrPngBuffer
  } catch (error) {
    console.error('[generateTicketImage] Failed to generate ticket PNG:', error)
    throw new Error('Failed to generate ticket image')
  }
}

/**
 * Generates PNG images for multiple tickets.
 * Returns an array of buffers with filename and MIME type.
 */
export async function generateTicketImages(
  tickets: TicketData[]
): Promise<
  Array<{
    filename: string
    content: Buffer
    mimeType: string
  }>
> {
  const results = await Promise.all(
    tickets.map(async (ticket) => {
      const buffer = await generateTicketImage(ticket)
      return {
        filename: `ticket-${ticket.ticketNumber}.png`,
        content: buffer,
        mimeType: 'image/png',
      }
    })
  )
  return results
}
