export interface IDashboardRepository {
  getTimezone(tenantId: string): Promise<string>;
  getMetrics(tenantId: string, today: Date, tomorrow: Date): Promise<any>;
  getRecentBookings(tenantId: string): Promise<any[]>;
  getTodaysBookings(tenantId: string, today: Date, tomorrow: Date): Promise<any[]>;
  getRevenueByDay(tenantId: string, sevenDaysAgo: Date): Promise<any[]>;
  getUnassignedBookings(tenantId: string): Promise<any[]>;
}
