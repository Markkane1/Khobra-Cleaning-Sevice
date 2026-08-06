CREATE TABLE "NativePushToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NativePushToken_token_key" ON "NativePushToken"("token");
CREATE INDEX "NativePushToken_tenantId_userId_active_idx" ON "NativePushToken"("tenantId", "userId", "active");

ALTER TABLE "NativePushToken" ADD CONSTRAINT "NativePushToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NativePushToken" ADD CONSTRAINT "NativePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
