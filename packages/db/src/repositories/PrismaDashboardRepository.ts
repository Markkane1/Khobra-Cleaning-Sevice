import { PrismaClient } from '@prisma/client';
import { IDashboardRepository } from '@repo/application/src/dashboard/IDashboardRepository';

export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  async getMetrics(tenantId: string, today: Date, tomorrow: Date): Promise<any> {
    const [totalBookings, todayBookings, completedBookings, pendingBookings, cancelledBookings, inProgressBookings, totalCustomers, activeEmployees, totalRevenue, pendingPayments, openComplaints, lowStockItems, totalInvoices, paidInvoices, overdueInvoices, onLeaveEmployees] = await Promise.all([
      this.db.booking.count({ where: { tenantId } }),
      this.db.booking.count({ where: { tenantId, scheduledDate: { gte: today, lt: tomorrow } } }),
      this.db.booking.count({ where: { tenantId, status: 'completed' } }),
      this.db.booking.count({ where: { tenantId, status: 'pending' } }),
      this.db.booking.count({ where: { tenantId, status: 'cancelled' } }),
      this.db.booking.count({ where: { tenantId, status: 'in_progress' } }),
      this.db.customer.count({ where: { tenantId } }),
      this.db.employee.count({ where: { tenantId, status: 'active' } }),
      this.db.invoice.aggregate({ where: { tenantId, status: 'paid' }, _sum: { totalAmount: true } }),
      this.db.invoice.aggregate({ where: { tenantId, status: { in: ['issued', 'overdue'] } }, _sum: { totalAmount: true, paidAmount: true } }),
      this.db.complaint.count({ where: { tenantId, status: { in: ['open', 'in_progress'] } } }),
      this.db.inventoryItem.count({ where: { tenantId, currentStock: { lte: this.db.inventoryItem.fields.minStock } } }),
      this.db.invoice.count({ where: { tenantId } }),
      this.db.invoice.count({ where: { tenantId, status: 'paid' } }),
      this.db.invoice.count({ where: { tenantId, status: 'overdue' } }),
      this.db.employee.count({ where: { tenantId, status: 'on_leave' } }),
    ]);

    return {
      totalBookings, todayBookings, completedBookings, pendingBookings, cancelledBookings, inProgressBookings, totalCustomers, activeEmployees, totalRevenue, pendingPayments, openComplaints, lowStockItems, totalInvoices, paidInvoices, overdueInvoices, onLeaveEmployees
    };
  }

  async getRecentBookings(tenantId: string): Promise<any[]> {
    return this.db.booking.findMany({
      where: { tenantId },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { customer: { include: { user: { select: { name: true } } } }, service: { select: { name: true } } },
    });
  }

  async getTodaysBookings(tenantId: string, today: Date, tomorrow: Date): Promise<any[]> {
    return this.db.booking.findMany({
      where: { tenantId, scheduledDate: { gte: today, lt: tomorrow } },
      include: { customer: { include: { user: { select: { name: true } } } }, service: { select: { name: true } }, assignments: { include: { employee: { include: { user: { select: { name: true } } } } } } },
      orderBy: { startTime: 'asc' },
    });
  }

  async getRevenueByDay(tenantId: string, sevenDaysAgo: Date): Promise<any[]> {
    return this.db.invoice.findMany({
      where: { tenantId, issuedAt: { gte: sevenDaysAgo }, status: 'paid' },
      select: { issuedAt: true, totalAmount: true },
    });
  }

  async getUnassignedBookings(tenantId: string): Promise<any[]> {
    return this.db.booking.findMany({
      where: { tenantId, status: { in: ['pending', 'confirmed'] }, assignments: { none: {} } },
      include: { customer: { include: { user: { select: { name: true } } } }, service: { select: { name: true } } },
      take: 5,
    });
  }
}
