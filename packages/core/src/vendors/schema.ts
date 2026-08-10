import { z } from 'zod';
import { EmailSchema } from '../email.ts';

export const CreateVendorSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required'),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: EmailSchema.optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial().extend({
  id: z.string().min(1, 'Vendor ID is required'),
});

export type CreateVendorDTO = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDTO = z.infer<typeof UpdateVendorSchema>;
