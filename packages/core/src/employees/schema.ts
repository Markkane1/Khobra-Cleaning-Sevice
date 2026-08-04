import { z } from 'zod';

export const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  skills: z.string().optional(),
  baseSalary: z.number().optional().default(0),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters'),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.omit({ temporaryPassword: true }).partial().extend({
  id: z.string(),
  status: z.string().optional(),
});

export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;
