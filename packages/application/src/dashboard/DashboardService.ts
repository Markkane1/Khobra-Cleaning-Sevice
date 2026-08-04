import { IDashboardRepository } from './IDashboardRepository';
import { DashboardDTO } from '@repo/core/src/dashboard/schema';
import { calendarDayRange, zonedDayRange } from '@repo/core';

export class DashboardService {
  constructor(private readonly dashboardRepository: IDashboardRepository) {}

  async getDashboardData(tenantId: string): Promise<DashboardDTO> {
    if (!tenantId) throw new Error('Tenant ID is required');

    const timeZone = await this.dashboardRepository.getTimezone(tenantId);
    const { start: today, end: tomorrow } = calendarDayRange(new Date(), timeZone);
    const { start: revenueStart } = zonedDayRange(new Date(Date.now() - 13 * 86_400_000), timeZone);

    const [metrics, recentBookings, todaysBookings, revenueByDay, unassignedBookings] = await Promise.all([
      this.dashboardRepository.getMetrics(tenantId, today, tomorrow),
      this.dashboardRepository.getRecentBookings(tenantId),
      this.dashboardRepository.getTodaysBookings(tenantId, today, tomorrow),
      this.dashboardRepository.getRevenueByDay(tenantId, revenueStart),
      this.dashboardRepository.getUnassignedBookings(tenantId),
    ]);

    const cashOutflow = Number(metrics.businessExpenses._sum.amount || 0) + Number(metrics.driverExpenses._sum.amount || 0) + Number(metrics.paidPayroll._sum.netSalary || 0)
    const totalRevenue = Number(metrics.totalRevenue._sum.amount || 0)
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
        totalRevenue,
        cashInflow: metrics.inflowByMethod.find((item: any) => item.method === 'cash')?._sum.amount || 0,
        bankInflow: metrics.inflowByMethod.find((item: any) => item.method === 'bank_transfer')?._sum.amount || 0,
        cashOutflow,
        netCashFlow: totalRevenue - cashOutflow,
        bookingStatusCounts: Object.fromEntries(metrics.statusCounts.map((item: any) => [item.status, item._count.status])),
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
