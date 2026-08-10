DROP INDEX IF EXISTS "Employee_employeeCode_key";
DROP INDEX IF EXISTS "Driver_driverCode_key";
DROP INDEX IF EXISTS "Booking_bookingNo_key";
DROP INDEX IF EXISTS "Invoice_invoiceNo_key";
DROP INDEX IF EXISTS "Complaint_complaintNo_key";

CREATE UNIQUE INDEX "Employee_tenantId_employeeCode_key" ON "Employee"("tenantId", "employeeCode");
CREATE UNIQUE INDEX "Driver_tenantId_driverCode_key" ON "Driver"("tenantId", "driverCode");
CREATE UNIQUE INDEX "Booking_tenantId_bookingNo_key" ON "Booking"("tenantId", "bookingNo");
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNo_key" ON "Invoice"("tenantId", "invoiceNo");
CREATE UNIQUE INDEX "Complaint_tenantId_complaintNo_key" ON "Complaint"("tenantId", "complaintNo");
