import { UpdatePayrollDTO } from '@repo/core';

export interface PayrollRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  month: string;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: string;
  paidAt?: Date | null;
  notes?: string | null;
}

export interface PayrollSummary {
  records: any[];
  summary: any;
}

export interface IPayrollRepository {
  getPayrollSummary(tenantId: string, year: number, month: string): Promise<PayrollSummary>;
  updateOrCreateRecord(tenantId: string, year: number, month: string, data: UpdatePayrollDTO): Promise<PayrollRecord>;
}
