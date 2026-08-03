import { IDashboardRepository } from './IDashboardRepository';
import { DashboardDTO } from '@repo/core/src/dashboard/schema';

export class DashboardService {
  constructor(private readonly dashboardRepository: IDashboardRepository) {}

  async getDashboardData(tenantId: string): Promise<DashboardDTO> {
    if (!tenantId) throw new Error('Tenant ID is required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [metrics, recentBookings, todaysBookings, revenueByDay, unassignedBookings] = await Promise.all([
      this.dashboardRepository.getMetrics(tenantId, today, tomorrow),
      this.dashboardRepository.getRecentBookings(tenantId),
      this.dashboardRepository.getTodaysBookings(tenantId, today, tomorrow),
      this.dashboardRepository.getRevenueByDay(tenantId, sevenDaysAgo),
      this.dashboardRepository.getUnassignedBookings(tenantId),
    ]);

    return {
      stats: {
        totalBookings: metrics.totalBookings,
        todayBookings: metrics.todayBookings,
        completedBookings: metrics.completedBookings,
        pendingBookings: metrics.pendingBookings,
        cancelledBookings: metrics.cancelledBookings,
        inProgressBookings: metrics.inProgressBookings,
        totalCustomers: metrics.totalCustomers,
        activeEmployees: metrics.activeEmployees,
        totalRevenue: metrics.totalRevenue._sum.totalAmount || 0,
        pendingPaymentAmount: (metrics.pendingPayments._sum.totalAmount || 0) - (metrics.pendingPayments._sum.paidAmount || 0),
        openComplaints: metrics.openComplaints,
        lowStockItems: metrics.lowStockItems,
        totalInvoices: metrics.totalInvoices,
        paidInvoices: metrics.paidInvoices,
        overdueInvoices: metrics.overdueInvoices,
        onLeaveEmployees: metrics.onLeaveEmployees,
      },
      recentBookings,
      todaysBookings,
      revenueByDay,
      unassignedBookings,
    };
  }
}
