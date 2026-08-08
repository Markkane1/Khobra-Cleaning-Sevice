CREATE INDEX IF NOT EXISTS "LeaveRecord_tenantId_status_startDate_endDate_idx"
  ON "LeaveRecord"("tenantId", "status", "startDate", "endDate");

CREATE INDEX IF NOT EXISTS "Booking_tenantId_scheduledDate_status_idx"
  ON "Booking"("tenantId", "scheduledDate", "status");

CREATE INDEX IF NOT EXISTS "Assignment_tenantId_employeeId_status_idx"
  ON "Assignment"("tenantId", "employeeId", "status");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_createdAt_idx"
  ON "Invoice"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_status_createdAt_idx"
  ON "Payment"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_itemId_createdAt_idx"
  ON "StockMovement"("tenantId", "itemId", "createdAt");
