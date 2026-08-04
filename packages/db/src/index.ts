import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db


export * from './repositories/PrismaActivityRepository';
export * from './repositories/PrismaAttendanceRepository';
export * from './repositories/PrismaBookingRepository';
export * from './repositories/PrismaBranchRepository';
export * from './repositories/PrismaComplaintRepository';
export * from './repositories/PrismaCustomerRepository';
export * from './repositories/PrismaDashboardRepository';
export * from './repositories/PrismaDriverRepository';
export * from './repositories/PrismaEmployeeRepository';
export * from './repositories/PrismaInventoryItemRepository';
export * from './repositories/PrismaInvoicePdfRepository';
export * from './repositories/PrismaInvoiceRepository';
export * from './repositories/PrismaLeaveRepository';
export * from './repositories/PrismaNotificationRepository';
export * from './repositories/PrismaPaymentRepository';
export * from './repositories/PrismaPayrollRepository';
export * from './repositories/PrismaServiceRepository';
export * from './repositories/PrismaSettingsRepository';
export * from './repositories/PrismaStatsRepository';
export * from './transaction-snapshot';
export * from './repositories/PrismaTripRepository';
export * from './repositories/PrismaVendorItemRepository';
export * from './repositories/PrismaVendorRepository';
