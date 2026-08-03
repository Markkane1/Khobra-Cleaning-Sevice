import { z } from 'zod';

export const StatsResponseSchema = z.object({
  totalBookings: z.number(),
  totalRevenue: z.number(),
  totalCustomers: z.number(),
  totalEmployees: z.number(),
  totalComplaints: z.number(),
  avgAttendanceRate: z.number(),
});

export type StatsDTO = z.infer<typeof StatsResponseSchema>;
