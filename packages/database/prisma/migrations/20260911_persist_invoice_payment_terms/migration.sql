-- Preserve invoice-specific payment terms instead of falling back to the global default after reload.
ALTER TABLE "invoices" ADD COLUMN "paymentTerms" TEXT;
