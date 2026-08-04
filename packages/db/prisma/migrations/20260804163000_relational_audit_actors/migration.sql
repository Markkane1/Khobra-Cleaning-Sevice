-- Normalize historical free-form actor values before enforcing identity references.
UPDATE "CompanyBankAccount" x SET "createdBy" = COALESCE((SELECT u.id FROM "User" u WHERE u."tenantId" = x."tenantId" AND u.role = 'admin' ORDER BY u."createdAt" LIMIT 1), x."createdBy") WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."createdBy");
UPDATE "CompanyBankAccount" x SET "updatedBy" = COALESCE((SELECT u.id FROM "User" u WHERE u."tenantId" = x."tenantId" AND u.role = 'admin' ORDER BY u."createdAt" LIMIT 1), x."updatedBy") WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."updatedBy");
UPDATE "BookingPickupAlert" x SET "generatedBy" = COALESCE((SELECT u.id FROM "Booking" b JOIN "User" u ON u."tenantId" = b."tenantId" AND u.role = 'admin' WHERE b.id = x."bookingId" ORDER BY u."createdAt" LIMIT 1), x."generatedBy") WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."generatedBy");
UPDATE "DriverExpense" x SET "submittedBy" = COALESCE((SELECT u.id FROM "User" u WHERE u."tenantId" = x."tenantId" AND u.role = 'admin' ORDER BY u."createdAt" LIMIT 1), x."submittedBy") WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."submittedBy");
UPDATE "BusinessExpense" x SET "createdBy" = COALESCE((SELECT u.id FROM "User" u WHERE u."tenantId" = x."tenantId" AND u.role = 'admin' ORDER BY u."createdAt" LIMIT 1), x."createdBy") WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."createdBy");

-- Preserve required audit identities whose original user row was historically removed.
INSERT INTO "User" (id, "tenantId", email, name, role, status, "sessionVersion", "createdAt", "updatedAt")
SELECT actor_id, MIN(tenant_id), 'deleted+' || md5(actor_id) || '@audit.invalid', 'Deleted user', 'admin', 'deleted', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT "createdBy" actor_id, "tenantId" tenant_id FROM "CompanyBankAccount"
  UNION ALL SELECT "updatedBy", "tenantId" FROM "CompanyBankAccount"
  UNION ALL SELECT a."generatedBy", b."tenantId" FROM "BookingPickupAlert" a JOIN "Booking" b ON b.id = a."bookingId"
  UNION ALL SELECT "submittedBy", "tenantId" FROM "DriverExpense"
  UNION ALL SELECT "createdBy", "tenantId" FROM "BusinessExpense"
) actors
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = actor_id)
GROUP BY actor_id
ON CONFLICT (id) DO NOTHING;

UPDATE "CompanyBankAccount" x SET "activatedBy" = NULL WHERE "activatedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."activatedBy");
UPDATE "CompanyBankAccount" x SET "deactivatedBy" = NULL WHERE "deactivatedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."deactivatedBy");
UPDATE "CompanyBankAccount" x SET "deletedBy" = NULL WHERE "deletedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."deletedBy");
UPDATE "LeaveRecord" x SET "approvedBy" = NULL WHERE "approvedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."approvedBy");
UPDATE "Booking" x SET "createdBy" = NULL WHERE "createdBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."createdBy");
UPDATE "Booking" x SET "cancelledBy" = NULL WHERE "cancelledBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."cancelledBy");
UPDATE "DriverExpense" x SET "approvedBy" = NULL WHERE "approvedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."approvedBy");
UPDATE "Payment" x SET "receivedBy" = NULL WHERE "receivedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."receivedBy");
UPDATE "Payment" x SET "selectedBy" = NULL WHERE "selectedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."selectedBy");
UPDATE "Payment" x SET "verifiedBy" = NULL WHERE "verifiedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."verifiedBy");
UPDATE "PaymentEvent" x SET "actorId" = NULL WHERE "actorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."actorId");
UPDATE "Complaint" x SET "assignedTo" = NULL WHERE "assignedTo" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = x."assignedTo");

ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_deactivatedBy_fkey" FOREIGN KEY ("deactivatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaveRecord" ADD CONSTRAINT "LeaveRecord_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingPickupAlert" ADD CONSTRAINT "BookingPickupAlert_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverExpense" ADD CONSTRAINT "DriverExpense_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverExpense" ADD CONSTRAINT "DriverExpense_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessExpense" ADD CONSTRAINT "BusinessExpense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_selectedBy_fkey" FOREIGN KEY ("selectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
