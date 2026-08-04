ALTER TABLE "Service" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Trip" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Service_tenantId_deletedAt_idx" ON "Service"("tenantId", "deletedAt");
CREATE INDEX "Booking_tenantId_deletedAt_idx" ON "Booking"("tenantId", "deletedAt");
CREATE INDEX "Complaint_tenantId_deletedAt_idx" ON "Complaint"("tenantId", "deletedAt");
CREATE INDEX "Trip_tenantId_deletedAt_idx" ON "Trip"("tenantId", "deletedAt");
