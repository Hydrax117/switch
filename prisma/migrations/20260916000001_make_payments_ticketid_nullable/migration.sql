-- Migration: make_payments_ticketId_nullable
-- Makes payments.ticketId nullable since new time-slot orders link via orderId instead

-- Drop the existing NOT NULL constraint on ticketId
ALTER TABLE "payments"
  ALTER COLUMN "ticketId" DROP NOT NULL;

-- Ensure orderId is required (now that it's the primary FK)
ALTER TABLE "payments"
  ALTER COLUMN "orderId" SET NOT NULL;
