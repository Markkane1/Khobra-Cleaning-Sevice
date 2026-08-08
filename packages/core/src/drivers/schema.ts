import { z } from 'zod';
import { EmailSchema } from '../email';

export const CreateDriverSchema = z.object({
  name: z.string().min(1, 'Driver name is required'),
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.string().optional(),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters'),
});

export const UpdateDriverSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.string().optional(),
});

export type CreateDriverDTO = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverDTO = z.infer<typeof UpdateDriverSchema>;
