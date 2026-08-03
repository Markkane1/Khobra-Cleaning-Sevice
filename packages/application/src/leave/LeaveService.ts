import { CreateLeaveDTO, UpdateLeaveDTO } from '@repo/core';
import { ILeaveRepository, LeaveRecord } from './ILeaveRepository';

export class LeaveService {
  constructor(private readonly leaveRepository: ILeaveRepository) {}

  async getLeaveRecords(tenantId: string): Promise<LeaveRecord[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.leaveRepository.findManyByTenant(tenantId);
  }

  async createLeaveRecord(tenantId: string, data: CreateLeaveDTO): Promise<LeaveRecord> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.leaveRepository.create(tenantId, data);
  }

  async updateLeaveRecord(data: UpdateLeaveDTO): Promise<LeaveRecord> {
    const existing = await this.leaveRepository.findById(data.id);
    if (!existing) throw new Error('Leave record not found');
    return this.leaveRepository.update(data.id, data);
  }

  async deleteLeaveRecord(id: string): Promise<void> {
    const existing = await this.leaveRepository.findById(id);
    if (!existing) throw new Error('Leave record not found');
    return this.leaveRepository.delete(id);
  }
}
