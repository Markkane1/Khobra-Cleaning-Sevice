import { PrismaClient } from '@prisma/client';
import { IPayrollRepository, PayrollSummary, PayrollRecord } from '@repo/application';
import { UpdatePayrollDTO, zonedMonthRange } from '@repo/core';

export class PrismaPayrollRepository implements IPayrollRepository {
  constructor(private readonly db: PrismaClient) {}

  async getTimezone(tenantId: string): Promise<string> {
    return (await this.db.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || 'UTC';
  }

  async getPayrollSummary(tenantId: string, year: number, month: string): Promise<PayrollSummary> {
    const monthNumber = new Date(`${month} 1, 2000 UTC`).getUTCMonth() + 1;
    if (!Number.isInteger(monthNumber)) throw new Error('Invalid payroll month');
    const { start: monthStart, end: monthEnd } = zonedMonthRange(year, monthNumber, await this.getTimezone(tenantId));

    const existingRecords = await this.db.payrollRecord.findMany({
      where: { tenantId, year, month },
    });
    const existingMap = new Map(existingRecords.map(r => [r.employeeId, r]));

    const employees = await this.db.employee.findMany({
      where: { tenantId },
      include: {
        user: { select: { name: true, email: true } },
        attendances: {
          where: { date: { gte: monthStart, lt: monthEnd } },
          select: { id: true, status: true, date: true },
        },
        assignments: {
          where: {
            status: 'completed',
            completedAt: { gte: monthStart, lt: monthEnd },
          },
          select: { id: true, actualHours: true, overtimeHours: true },
        },
      },
    });

    const records = employees.map((emp) => {
      const dbRec = existingMap.get(emp.id);
      const baseSalary = Number(emp.baseSalary || 0);
      const dailyRate = baseSalary / 22;
      const hourlyRate = dailyRate / 8;

      const daysPresent = emp.attendances.filter((a) => a.status === 'present').length;
      const daysAbsent = emp.attendances.filter((a) => a.status === 'absent').length;

      const totalOvertimeHours = emp.assignments.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
      const additionalOvertime = emp.assignments.reduce((sum, a) => {
        const actual = a.actualHours || 0;
        if (actual > 8 && !a.overtimeHours) {
          return sum + (actual - 8);
        }
        return sum;
      }, 0);
      
      const overtimeHours = totalOvertimeHours + additionalOvertime;
      const overtimePay = overtimeHours * hourlyRate * 1.5;
      const deductions = dbRec ? Number(dbRec.deductions) : daysAbsent * dailyRate;
      const netSalary = dbRec ? Number(dbRec.netSalary) : baseSalary - deductions + overtimePay;

      return {
        id: emp.id,
        recordId: dbRec?.id || null,
        employeeCode: emp.employeeCode,
        name: emp.user.name,
        email: emp.user.email,
        baseSalary: Math.round(baseSalary),
        daysPresent,
        daysAbsent,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        overtimePay: Math.round(overtimePay),
        deductions: Math.round(deductions),
        grossSalary: Math.round(baseSalary + overtimePay),
        netSalary: Math.round(netSalary),
        status: emp.status,
        payrollStatus: dbRec ? dbRec.status : 'pending',
        paidAt: dbRec?.paidAt || null,
      };
    });

    const summary = {
      totalGross: records.reduce((s, r) => s + r.grossSalary, 0),
      totalDeductions: records.reduce((s, r) => s + r.deductions, 0),
      totalOvertime: records.reduce((s, r) => s + r.overtimePay, 0),
      totalNet: records.reduce((s, r) => s + r.netSalary, 0),
      employeeCount: records.length,
      month: `${month} ${year}`,
    };

    return { records, summary };
  }

  async updateOrCreateRecord(tenantId: string, year: number, month: string, data: UpdatePayrollDTO): Promise<PayrollRecord> {
    const emp = await this.db.employee.findFirst({ where: { id: data.employeeId, tenantId } });
    if (!emp) throw new Error('Employee not found');

    const currentBase = data.baseSalary ?? Number(emp.baseSalary ?? 0);
    const currentDeductions = data.deductions ?? 0;
    const currentAllowances = data.allowances ?? 0;
    const currentNet = data.netSalary ?? (currentBase - currentDeductions + currentAllowances);

    const existingRecord = await this.db.payrollRecord.findFirst({
      where: { tenantId, employeeId: data.employeeId, year, month },
    });

    if (existingRecord) {
      return this.db.payrollRecord.update({
        where: { id: existingRecord.id },
        data: {
          status: data.status || 'approved',
          baseSalary: currentBase,
          deductions: currentDeductions,
          allowances: currentAllowances,
          netSalary: currentNet,
          ...(data.status === 'paid' ? { paidAt: new Date() } : {}),
        },
      }) as unknown as PayrollRecord;
    } else {
      return this.db.payrollRecord.create({
        data: {
          tenantId,
          employeeId: data.employeeId,
          month,
          year,
          baseSalary: currentBase,
          deductions: currentDeductions,
          allowances: currentAllowances,
          netSalary: currentNet,
          status: data.status || 'approved',
          ...(data.status === 'paid' ? { paidAt: new Date() } : {}),
        },
      }) as unknown as PayrollRecord;
    }
  }
}
