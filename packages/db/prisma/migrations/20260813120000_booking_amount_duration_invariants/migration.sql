-- Completed assignments honor the business-wide two-hour minimum.
UPDATE "Assignment"
SET "actualHours" = 2
WHERE "actualHours" IS NOT NULL
  AND "actualHours" < 2;

-- Restore invoices that were incorrectly repriced from short measured work time.
-- Existing payments remain untouched; underpayments become an outstanding balance.
WITH "BookingPrice" AS (
  SELECT
    b."id",
    b."netAmount",
    b."totalAmount",
    b."discount",
    ROUND((
      COALESCE(
        NULLIF(SUM(bi."totalAmount"), 0),
        b."hourlyRate" * b."employeeCount" * b."duration"
      ) + b."materialsCost"
    )::numeric, 2) AS "subtotal"
  FROM "Booking" b
  LEFT JOIN "BookingItem" bi ON bi."bookingId" = b."id"
  WHERE b."status" = 'completed'
  GROUP BY b."id"
)
UPDATE "Invoice" i
SET
  "subtotal" = p."subtotal",
  "taxAmount" = GREATEST(0, p."totalAmount" - p."subtotal"),
  "discount" = p."discount",
  "totalAmount" = p."netAmount",
  "status" = CASE
    WHEN i."paidAmount" >= p."netAmount" THEN 'paid'
    WHEN i."paidAmount" > 0 THEN 'partially_paid'
    ELSE 'issued'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "BookingPrice" p
WHERE i."bookingId" = p."id"
  AND ABS(i."totalAmount" - p."netAmount") > 0.009;
