import { CreateLeaveDTO, UpdateLeaveDTO } from '@repo/core';

export interface LeaveRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  type: string;
  startDate: Date;
  endDate: Date;
  days: number;
  status: string;
  reason?: string | null;
  approvedBy?: string | null;
  employee?: any;
}

export interface ILeaveRepository {
  findManyByTenant(tenantId: string): Promise<LeaveRecord[]>;
  findById(tenantId: string, id: string): Promise<LeaveRecord | null>;
  create(tenantId: string, data: CreateLeaveDTO): Promise<LeaveRecord>;
  update(tenantId: string, id: string, data: UpdateLeaveDTO, approvedByUserId?: string): Promise<LeaveRecord>;
  delete(tenantId: string, id: string): Promise<void>;
}
