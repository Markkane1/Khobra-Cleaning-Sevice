import { z } from 'zod';

export const UpdatePayrollSchema = z.object({
  employeeId: z.string().min(1, 'Cleaner is required'),
  status: z.string().optional(),
  baseSalary: z.coerce.number().nonnegative('Base salary cannot be negative').optional(),
  deductions: z.coerce.number().nonnegative('Deductions cannot be negative').optional(),
  allowances: z.coerce.number().nonnegative('Allowances cannot be negative').optional(),
  netSalary: z.coerce.number().nonnegative('Net salary cannot be negative').optional(),
});

export type UpdatePayrollDTO = z.infer<typeof UpdatePayrollSchema>;
