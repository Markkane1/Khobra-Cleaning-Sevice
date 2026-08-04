import { PrismaClient } from '@prisma/client';
import { IStatsRepository } from '@repo/application/src/stats/IStatsRepository';

export class PrismaStatsRepository implements IStatsRepository {
  constructor(private readonly db: PrismaClient) {}

  async getTotalBookings(tenantId: string): Promise<number> {
    return this.db.booking.count({ where: { tenantId } });
  }

  async getTotalCustomers(tenantId: string): Promise<number> {
    return this.db.customer.count({ where: { tenantId } });
  }

  async getTotalEmployees(tenantId: string): Promise<number> {
    return this.db.employee.count({ where: { tenantId } });
  }

  async getTotalComplaints(tenantId: string): Promise<number> {
    return this.db.complaint.count({ where: { tenantId } });
  }

  async getTotalRevenue(tenantId: string): Promise<number> {
    const revenueResult = await this.db.payment.aggregate({
      where: { tenantId, status: { in: ['paid', 'verified'] } },
      _sum: { amount: true },
    });
    return Number(revenueResult._sum.amount || 0);
  }

  async getAttendanceStats(tenantId: string): Promise<{ status: string; _count: { status: number } }[]> {
    return this.db.attendance.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    }) as unknown as { status: string; _count: { status: number } }[];
  }
}
