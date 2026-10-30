# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] — 2026-10-30

### Added

#### Guest Ticket Confirmation Email

- Guest purchasers now receive a different confirmation email from authenticated users
- Guest email includes a personal greeting by first name
- "Download Tickets" button always present — links to `GET /api/tickets/guest-download?reservation=<id>` (no login required)
- For bulk orders (5+ tickets) the button links to the Supabase-hosted ZIP instead, with expiry date shown
- Ticket PNG images are still attached for small orders; the download button serves as a fallback in case the attachment doesn't arrive
- "Good to know" tips block: show ticket at door, save the email, don't share QR codes publicly
- "Create an account" nudge at the bottom — links to `/login` so guests can claim their order history
- Authenticated users continue to receive the existing email with a "View all my tickets" CTA

#### Guest Ticket Download API

- `GET /api/tickets/guest-download?reservation=<reservationId>` — public endpoint, no auth required
- Returns a single PNG for 1-ticket orders, a ZIP archive for multi-ticket orders
- Ownership is verified via `reservationId` (only the email recipient has the link) + `status === COMPLETED` guard
- Simple in-memory rate limit: 10 requests per reservation ID per minute to prevent enumeration

#### Ticket Image Sizing Fix

- Ticket PNG canvas height increased from `680px` to `780px` to prevent Satori clipping the QR section
- QR frame padding reduced slightly (`20px` → `16px`) and QR image resized (`190px` → `180px`) to maintain proportions

#### Ticket Image Banner Fix

- Event banner image was appearing zoomed in — Satori does not reliably resolve percentage dimensions on absolutely-positioned children, causing the image to render at its intrinsic size and overflow
- Fixed by replacing `width: '100%'` / `height: '100%'` with explicit pixel values (`width: '400px'`, `height: '200px'`) so Satori scales the image correctly
- Banner height increased from `170px` to `200px` to give poster-style images more room and avoid subjects being cropped

### Changed

- `isGuest` flag added to Paystack transaction metadata in all three payment init routes (`initialize`, `initialize-ga`, `initialize-shows`)
- Webhook handler reads `meta.isGuest` and passes it to `sendTicketConfirmationEmail`
- `sendTicketConfirmationEmail` accepts new optional `isGuest` param and branches between `buildAuthEmail` and `buildGuestEmail` helpers

#### Guest Checkout

- Users can now purchase tickets without creating an account or signing in
- Billing information form (First Name, Last Name, Phone, Email, Country) collected at checkout for all order types — GA, reserved seating, and time-slot/show orders
- Guest users are upserted by email into the `User` table so FK constraints are satisfied; they can claim their account later via OTP login
- Ticket confirmation emails are sent to the billing email provided at checkout
- `BillingInfoForm` shared component (`features/checkout/components/billing-info-form.tsx`) with client-side validation

#### Checkout Flow Changes

- Removed authentication guard from the checkout page (`/events/[slug]/checkout`)
- Removed authentication guard from the seats page (`/events/[slug]/seats`)
- Removed authentication guard from the checkout success page (`/events/[slug]/checkout/success`)
- "Buy Tickets" button on event pages no longer redirects to login — goes directly to checkout
- Reserved seating: guests defer seat reservation to pay-time (once billing email is known) rather than on page mount
- `guestMode` prop added to `CheckoutClient`, `GACheckoutClient`, and `ShowCheckoutClient`

#### API Changes

- `POST /api/payments/initialize-ga` — removed auth requirement; accepts `billingInfo`; upserts guest user by email
- `POST /api/payments/initialize-shows` — removed auth requirement; accepts `billingInfo`; upserts guest user by email
- `POST /api/payments/initialize` — removed auth requirement; accepts `billingInfo` via Zod schema; upserts guest user by email
- `GET /api/payments/status` — removed auth requirement for polling; ownership verified via `reservation.userId` instead of session; supports guest polling by `reservationId`

#### Server Action Changes

- `reserveSeats` — accepts optional `guestEmail` param to upsert a guest user when no session exists
- `reserveTimeSlots` — accepts optional `guestUserId` param passed from the API route
- `releaseReservation` — no longer requires an active session; verifies ownership via `reservation.userId`

#### Payment Confirmation Poller

- Added `isGuest` prop to `PaymentConfirmationPoller`
- Guests see "Back to event" instead of "View my tickets" (which requires auth) after confirmation

### Fixed

- `NEXT_PUBLIC_APP_URL` had a trailing `"` in `.env` causing malformed Paystack callback URLs
- `NODE_ENV` was set to `production` in local dev, causing session cookie issues
- Paystack was redirecting to `useswitch.net` after payment due to the malformed callback URL
- `reserveTimeSlots` was returning `UNAUTHENTICATED` for guests even after `userId` was resolved in the API route
- Checkout success page ticket queries used `session.userId` instead of `reservation.userId`, failing for guests
- Status polling API (`/api/payments/status`) returned 401 for guests, causing the confirmation poller to hang indefinitely
- `SiteHeader` called `session.email` directly instead of `session?.email`, crashing for unauthenticated page renders

### Changed

- `NEXT_PUBLIC_APP_URL` updated to ngrok tunnel URL for local Paystack testing
- Rate limiting key for payment init falls back to `pay-init:email:<email>` for guests instead of requiring a `userId`
- Billing info collected for all users (authenticated and guest) — authenticated users have their `name` updated on checkout

---

## Environment Setup Notes

### Local Paystack Testing (ngrok required)

Paystack cannot reach `localhost` for webhooks. Use ngrok:

```bash
ngrok http 3000
```

Then update `.env`:

```
NEXT_PUBLIC_APP_URL=https://<your-ngrok-id>.ngrok-free.app
```

And set in the Paystack dashboard (Test mode):

- **Test Webhook URL** → `https://<your-ngrok-id>.ngrok-free.app/api/webhooks/paystack`
- **Test Callback URL** → leave empty (sent per-transaction by the app)

Restart the dev server after any `.env` change.
