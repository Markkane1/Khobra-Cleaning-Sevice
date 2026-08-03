import { UpdatePayrollDTO } from '@repo/core';
import { IPayrollRepository, PayrollSummary, PayrollRecord } from './IPayrollRepository';

export class PayrollService {
  constructor(private readonly payrollRepository: IPayrollRepository) {}

  async getPayrollSummary(tenantId: string): Promise<PayrollSummary> {
    if (!tenantId) throw new Error('Tenant ID is required');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-US', { month: 'long' });
    
    return this.payrollRepository.getPayrollSummary(tenantId, year, month);
  }

  async updatePayrollRecord(tenantId: string, data: UpdatePayrollDTO): Promise<PayrollRecord> {
    if (!tenantId) throw new Error('Tenant ID is required');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-US', { month: 'long' });

    return this.payrollRepository.updateOrCreateRecord(tenantId, year, month, data);
  }
}
