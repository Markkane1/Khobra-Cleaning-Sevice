import { IActivityRepository } from './IActivityRepository';
import { ActivityDTO } from '@repo/core/src/activity/schema';

export class ActivityService {
  constructor(private readonly activityRepository: IActivityRepository) {}

  async getActivities(tenantId: string): Promise<ActivityDTO[]> {
    if (!tenantId) throw new Error('Tenant ID is required');

    const [recentBookings, recentPayments, recentComplaints, recentAttendance] = await Promise.all([
      this.activityRepository.getRecentBookings(tenantId),
      this.activityRepository.getRecentPayments(tenantId),
      this.activityRepository.getRecentComplaints(tenantId),
      this.activityRepository.getRecentAttendance(tenantId),
    ]);

    const activities: ActivityDTO[] = [];

    recentBookings.forEach((b: any) => {
      activities.push({
        type: b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'error' : 'info',
        label: `Booking ${b.bookingNo}`,
        detail: `${b.customer?.user?.name || 'Customer'} - ${b.service?.name || 'Service'} → ${b.status}`,
        time: b.updatedAt.toISOString(),
        icon: 'calendar',
      });
    });

    recentPayments.forEach((p: any) => {
      activities.push({
        type: 'success',
        label: `Payment AED ${p.amount.toLocaleString()}`,
        detail: `Invoice ${p.invoice?.invoiceNo || ''} via ${p.method}`,
        time: p.createdAt.toISOString(),
        icon: 'payment',
      });
    });

    recentComplaints.forEach((c: any) => {
      activities.push({
        type: c.status === 'resolved' ? 'success' : c.status === 'open' ? 'warning' : 'info',
        label: `Complaint ${c.complaintNo}`,
        detail: `${c.customer?.user?.name || 'Customer'} - ${c.priority} priority - ${c.status}`,
        time: c.updatedAt.toISOString(),
        icon: 'complaint',
      });
    });

    recentAttendance.forEach((a: any) => {
      activities.push({
        type: a.status === 'present' ? 'success' : 'error',
        label: `Attendance: ${a.employee?.user?.name || 'Cleaner'}`,
        detail: `${a.status} on ${a.date.toLocaleDateString('en-AE')}`,
        time: a.createdAt.toISOString(),
        icon: 'attendance',
      });
    });

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return activities.slice(0, 12);
  }
}
