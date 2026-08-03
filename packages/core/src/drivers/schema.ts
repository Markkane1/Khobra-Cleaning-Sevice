import { z } from 'zod';

export const CreateDriverSchema = z.object({
  name: z.string().min(1, 'Driver name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.string().optional(),
});

export const UpdateDriverSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().optional(),
  vehicleNo: z.string().optional(),
  status: z.string().optional(),
});

export type CreateDriverDTO = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverDTO = z.infer<typeof UpdateDriverSchema>;
