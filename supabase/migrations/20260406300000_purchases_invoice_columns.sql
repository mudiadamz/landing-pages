-- Add invoice-related columns to purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount integer DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_number text;

-- Unique index on invoice_number (partial: only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS purchases_invoice_number_key
  ON purchases (invoice_number)
  WHERE invoice_number IS NOT NULL;
