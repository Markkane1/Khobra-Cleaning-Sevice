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
  findById(id: string): Promise<LeaveRecord | null>;
  create(tenantId: string, data: CreateLeaveDTO): Promise<LeaveRecord>;
  update(id: string, data: UpdateLeaveDTO): Promise<LeaveRecord>;
  delete(id: string): Promise<void>;
}
