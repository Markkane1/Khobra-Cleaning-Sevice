import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaDashboardRepository } from '@repo/db/src/repositories/PrismaDashboardRepository';
import { DashboardService } from '@repo/application/src/dashboard/DashboardService';
import { requireAuth } from '@/lib/auth';
import { calendarDayRange } from '@repo/core';
import { apiErrorResponse } from '@/lib/api-error';

const dashboardRepository = new PrismaDashboardRepository(db);
const dashboardService = new DashboardService(dashboardRepository);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('response' in auth) return auth.response;
    if (auth.session.role !== 'admin') {
      const actor = auth.session.role === 'cleaner'
        ? await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId }, select: { id: true } })
        : auth.session.role === 'customer'
          ? await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId }, select: { id: true } })
          : await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId }, select: { id: true } });
      const bookingWhere = auth.session.role === 'cleaner'
        ? { tenantId: auth.session.tenantId, deletedAt: null, assignments: { some: { employeeId: actor?.id || '__none__' } } }
        : auth.session.role === 'customer'
          ? { tenantId: auth.session.tenantId, deletedAt: null, customerId: actor?.id || '__none__' }
          : { tenantId: auth.session.tenantId, deletedAt: null, driverId: actor?.id || '__none__' };
      const bookings = await db.booking.findMany({
        where: bookingWhere,
        include: { customer: { include: { user: { select: { name: true } } } }, service: { select: { name: true } }, assignments: { include: { employee: { include: { user: { select: { name: true } } } } } } },
        orderBy: { createdAt: 'desc' },
      });
      const scopedBookings = auth.session.role === 'cleaner'
        ? bookings.map(booking => ({ ...booking, assignments: booking.assignments.filter(assignment => assignment.employeeId === actor?.id) }))
        : bookings;
      const timeZone = (await db.tenant.findUnique({ where: { id: auth.session.tenantId }, select: { timezone: true } }))?.timezone || 'UTC';
      const { start: today, end: tomorrow } = calendarDayRange(new Date(), timeZone);
      const isToday = (date: Date) => date >= today && date < tomorrow;
      const bookingIds = scopedBookings.map(booking => booking.id);
      const openComplaints = await db.complaint.count({ where: { tenantId: auth.session.tenantId, bookingId: { in: bookingIds }, status: { in: ['open', 'in_progress'] } } });
      return NextResponse.json({
        stats: {
          totalBookings: scopedBookings.length,
          todayBookings: scopedBookings.filter(booking => isToday(booking.scheduledDate)).length,
          completedBookings: scopedBookings.filter(booking => booking.status === 'completed').length,
          pendingBookings: scopedBookings.filter(booking => ['pending', 'pending_assignment', 'assigned', 'scheduled'].includes(booking.status)).length,
          cancelledBookings: scopedBookings.filter(booking => booking.status === 'cancelled').length,
          inProgressBookings: scopedBookings.filter(booking => booking.status === 'in_progress').length,
          totalCustomers: new Set(scopedBookings.map(booking => booking.customerId)).size,
          activeEmployees: auth.session.role === 'cleaner' && actor ? 1 : 0,
          totalRevenue: 0, cashInflow: 0, bankInflow: 0, pendingPaymentAmount: 0,
          openComplaints, lowStockItems: 0, totalInvoices: 0, paidInvoices: 0, overdueInvoices: 0, onLeaveEmployees: 0,
        },
        recentBookings: scopedBookings.slice(0, 8),
        todaysBookings: scopedBookings.filter(booking => isToday(booking.scheduledDate)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
        revenueByDay: [],
        unassignedBookings: [],
      });
    }
    const data = await dashboardService.getDashboardData(auth.session.tenantId);

    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to load dashboard' });
  }
}


