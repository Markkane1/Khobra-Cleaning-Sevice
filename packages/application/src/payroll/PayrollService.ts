import { UpdatePayrollDTO, zonedYearMonth } from '@repo/core';
import { IPayrollRepository, PayrollSummary, PayrollRecord } from './IPayrollRepository';

export class PayrollService {
  constructor(private readonly payrollRepository: IPayrollRepository) {}

  async getPayrollSummary(tenantId: string): Promise<PayrollSummary> {
    if (!tenantId) throw new Error('Tenant ID is required');
    const { year, monthName: month } = zonedYearMonth(new Date(), await this.payrollRepository.getTimezone(tenantId));
    
    return this.payrollRepository.getPayrollSummary(tenantId, year, month);
  }

  async updatePayrollRecord(tenantId: string, data: UpdatePayrollDTO): Promise<PayrollRecord> {
    if (!tenantId) throw new Error('Tenant ID is required');
    const { year, monthName: month } = zonedYearMonth(new Date(), await this.payrollRepository.getTimezone(tenantId));

    return this.payrollRepository.updateOrCreateRecord(tenantId, year, month, data);
  }
}
