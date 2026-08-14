import { z } from 'zod';
import { EmailSchema } from '../email.ts';

export const CreateEmployeeSchema = z.object({
  email: EmailSchema,
  name: z.string().trim().min(1, 'Cleaner name is required'),
  phone: z.string().optional(),
  skills: z.string().optional(),
  baseSalary: z.coerce.number().nonnegative('Base salary cannot be negative').optional().default(0),
  status: z.enum(['active', 'on_leave', 'inactive']).optional().default('active'),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters'),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ temporaryPassword: true }).partial().extend({
  id: z.string().min(1, 'Cleaner ID is required'),
});

export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;
