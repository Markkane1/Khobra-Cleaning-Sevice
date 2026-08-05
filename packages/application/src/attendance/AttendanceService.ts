import { CreateAttendanceDTO, UpdateAttendanceDTO } from '@repo/core';
import { IAttendanceRepository, Attendance } from './IAttendanceRepository';

export class AttendanceService {
  constructor(private readonly attendanceRepository: IAttendanceRepository) {}

  async getAttendances(tenantId: string): Promise<Attendance[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.attendanceRepository.findManyByTenant(tenantId);
  }

  async createAttendance(tenantId: string, data: CreateAttendanceDTO): Promise<Attendance> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.attendanceRepository.create(tenantId, data);
  }

  async updateAttendance(tenantId: string, data: UpdateAttendanceDTO): Promise<Attendance> {
    const existing = await this.attendanceRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Attendance not found');
    return this.attendanceRepository.update(tenantId, data.id, data);
  }

  async deleteAttendance(tenantId: string, id: string): Promise<void> {
    const existing = await this.attendanceRepository.findById(tenantId, id);
    if (!existing) throw new Error('Attendance not found');
    return this.attendanceRepository.delete(tenantId, id);
  }
}
