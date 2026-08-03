import { PrismaClient } from '@prisma/client';
import { IActivityRepository } from '@repo/application/src/activity/IActivityRepository';

export class PrismaActivityRepository implements IActivityRepository {
  constructor(private readonly db: PrismaClient) {}

  async getRecentBookings(tenantId: string): Promise<any[]> {
    return this.db.booking.findMany({
      where: { tenantId },
      include: { customer: { include: { user: { select: { name: true } } } }, service: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
  }

  async getRecentPayments(tenantId: string): Promise<any[]> {
    return this.db.payment.findMany({
      where: { tenantId },
      include: { invoice: { select: { invoiceNo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  async getRecentComplaints(tenantId: string): Promise<any[]> {
    return this.db.complaint.findMany({
      where: { tenantId },
      include: { customer: { include: { user: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });
  }

  async getRecentAttendance(tenantId: string): Promise<any[]> {
    return this.db.attendance.findMany({
      where: { tenantId },
      include: { employee: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }
}
