import { z } from 'zod';
import { EmailSchema } from '../email.ts';

export const CreateDriverSchema = z.object({
  name: z.string().min(1, 'Driver name is required'),
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.enum(['active', 'inactive', 'AVAILABLE']).optional(),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters'),
});

export const UpdateDriverSchema = z.object({
  id: z.string().min(1, 'Driver ID is required'),
  name: z.string().trim().min(1, 'Driver name is required').optional(),
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.enum(['active', 'inactive', 'AVAILABLE']).optional(),
});

export type CreateDriverDTO = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverDTO = z.infer<typeof UpdateDriverSchema>;
