ALTER TABLE "Payment"
  ADD COLUMN "legacyImportedAt" TIMESTAMP(3),
  ADD COLUMN "legacyReason" TEXT;

CREATE TABLE "ReferenceSequence" (
  "tenantId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "ReferenceSequence_pkey" PRIMARY KEY ("tenantId", "kind")
);

INSERT INTO "ReferenceSequence" ("tenantId", "kind", "value")
SELECT "tenantId", 'booking', COALESCE(MAX(NULLIF(regexp_replace("bookingNo", '[^0-9]', '', 'g'), '')::INTEGER), 999) FROM "Booking" GROUP BY "tenantId";
INSERT INTO "ReferenceSequence" ("tenantId", "kind", "value")
SELECT "tenantId", 'complaint', COALESCE(MAX(NULLIF(regexp_replace("complaintNo", '[^0-9]', '', 'g'), '')::INTEGER), 999) FROM "Complaint" GROUP BY "tenantId";
INSERT INTO "ReferenceSequence" ("tenantId", "kind", "value")
SELECT "tenantId", 'employee', COALESCE(MAX(NULLIF(regexp_replace("employeeCode", '[^0-9]', '', 'g'), '')::INTEGER), 0) FROM "Employee" GROUP BY "tenantId";
INSERT INTO "ReferenceSequence" ("tenantId", "kind", "value")
SELECT "tenantId", 'driver', COALESCE(MAX(NULLIF(regexp_replace("driverCode", '[^0-9]', '', 'g'), '')::INTEGER), 0) FROM "Driver" GROUP BY "tenantId";

-- These pre-workflow records predate proof/account capture. Preserve their historical
-- accounting effect, but label them so they are never represented as fully traceable.
UPDATE "Payment"
SET "legacyImportedAt" = COALESCE("verifiedAt", "createdAt"),
    "legacyReason" = 'Imported verified bank payment predates proof, reference, and company-bank-account capture'
WHERE "method" = 'bank_transfer'
  AND "status" IN ('paid', 'verified')
  AND ("proofUrl" IS NULL OR "referenceNo" IS NULL OR "companyBankAccountId" IS NULL);

-- Backfill a receivable for any historical completed booking that has no invoice.
INSERT INTO "Invoice" (
  "id", "tenantId", "invoiceNo", "bookingId", "customerId", "status",
  "issuedAt", "dueDate", "subtotal", "taxAmount", "discount", "totalAmount",
  "paidAmount", "notes", "createdAt", "updatedAt"
)
SELECT
  'legacy_inv_' || md5(b."id"), b."tenantId", 'INV-' || b."bookingNo", b."id", b."customerId", 'issued',
  COALESCE(b."completedAt", b."updatedAt"), COALESCE(b."completedAt", b."updatedAt"),
  b."totalAmount", 0, b."discount", b."netAmount", 0,
  'Backfilled for completed legacy booking without an invoice', NOW(), NOW()
FROM "Booking" b
WHERE b."status" = 'completed'
  AND NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."bookingId" = b."id");
