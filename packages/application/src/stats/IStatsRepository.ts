export interface IStatsRepository {
  getTotalBookings(tenantId: string): Promise<number>;
  getTotalCustomers(tenantId: string): Promise<number>;
  getTotalEmployees(tenantId: string): Promise<number>;
  getTotalComplaints(tenantId: string): Promise<number>;
  getTotalRevenue(tenantId: string): Promise<number>;
  getAttendanceStats(tenantId: string): Promise<{ status: string; _count: { status: number } }[]>;
}
