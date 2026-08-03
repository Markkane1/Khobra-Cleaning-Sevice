import { IStatsRepository } from './IStatsRepository';
import { StatsDTO } from '@repo/core/src/stats/schema';

export class StatsService {
  constructor(private readonly statsRepository: IStatsRepository) {}

  async getStats(tenantId: string): Promise<StatsDTO> {
    if (!tenantId) throw new Error('Tenant ID is required');

    const [totalBookings, totalCustomers, totalEmployees, totalComplaints, totalRevenue, attendanceStats] = await Promise.all([
      this.statsRepository.getTotalBookings(tenantId),
      this.statsRepository.getTotalCustomers(tenantId),
      this.statsRepository.getTotalEmployees(tenantId),
      this.statsRepository.getTotalComplaints(tenantId),
      this.statsRepository.getTotalRevenue(tenantId),
      this.statsRepository.getAttendanceStats(tenantId),
    ]);

    const totalAttendance = attendanceStats.reduce((sum, s) => sum + s._count.status, 0);
    const presentAttendance = attendanceStats.find(s => s.status === 'present')?._count.status || 0;
    const avgAttendanceRate = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;

    return {
      totalBookings,
      totalRevenue,
      totalCustomers,
      totalEmployees,
      totalComplaints,
      avgAttendanceRate,
    };
  }
}
