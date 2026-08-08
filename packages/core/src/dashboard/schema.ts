import { z } from 'zod'

const DashboardStatsSchema = z.object({
  totalBookings: z.number(),
  todayBookings: z.number(),
  completedBookings: z.number(),
  pendingBookings: z.number(),
  cancelledBookings: z.number(),
  inProgressBookings: z.number(),
  totalCustomers: z.number(),
  activeEmployees: z.number(),
  totalRevenue: z.coerce.number(),
  cashInflow: z.coerce.number(),
  bankInflow: z.coerce.number(),
  cashOutflow: z.coerce.number().optional(),
  netCashFlow: z.coerce.number().optional(),
  pendingPaymentAmount: z.coerce.number(),
  openComplaints: z.number(),
  lowStockItems: z.number(),
  totalInvoices: z.number(),
  paidInvoices: z.number(),
  overdueInvoices: z.number(),
  onLeaveEmployees: z.number(),
  bookingStatusCounts: z.record(z.string(), z.number()).optional(),
})

const DashboardBookingSchema = z.object({
  id: z.string(),
  bookingNo: z.string(),
  status: z.string(),
  scheduledDate: z.coerce.string(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  service: z.object({ name: z.string() }).nullable().optional(),
  customer: z.object({ user: z.object({ name: z.string() }).nullable().optional() }).nullable().optional(),
}).passthrough()

export const DashboardResponseSchema = z.object({
  stats: DashboardStatsSchema,
  recentBookings: z.array(DashboardBookingSchema),
  todaysBookings: z.array(DashboardBookingSchema),
  revenueByDay: z.array(z.object({ issuedAt: z.coerce.string(), totalAmount: z.coerce.number() })),
  unassignedBookings: z.array(DashboardBookingSchema),
})

export type DashboardDTO = z.infer<typeof DashboardResponseSchema>
