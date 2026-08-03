export interface IActivityRepository {
  getRecentBookings(tenantId: string): Promise<any[]>;
  getRecentPayments(tenantId: string): Promise<any[]>;
  getRecentComplaints(tenantId: string): Promise<any[]>;
  getRecentAttendance(tenantId: string): Promise<any[]>;
}
