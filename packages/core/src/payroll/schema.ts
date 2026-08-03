import { z } from 'zod';

export const UpdatePayrollSchema = z.object({
  employeeId: z.string(),
  status: z.string().optional(),
  baseSalary: z.number().optional(),
  deductions: z.number().optional(),
  allowances: z.number().optional(),
  netSalary: z.number().optional(),
});

export type UpdatePayrollDTO = z.infer<typeof UpdatePayrollSchema>;
