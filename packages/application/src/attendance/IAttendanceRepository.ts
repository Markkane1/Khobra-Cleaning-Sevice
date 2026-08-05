import { CreateAttendanceDTO, UpdateAttendanceDTO } from '@repo/core';

export interface Attendance {
  id: string;
  tenantId: string;
  employeeId: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  employee?: {
    user: {
      name: string;
    };
  };
}

export interface IAttendanceRepository {
  findManyByTenant(tenantId: string): Promise<Attendance[]>;
  findById(tenantId: string, id: string): Promise<Attendance | null>;
  create(tenantId: string, data: CreateAttendanceDTO): Promise<Attendance>;
  update(tenantId: string, id: string, data: UpdateAttendanceDTO): Promise<Attendance>;
  delete(tenantId: string, id: string): Promise<void>;
}
