import { z } from 'zod';
import { EmailSchema } from '../email';

export const CreateVendorSchema = z.object({
  name: z.string(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: EmailSchema.optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial().extend({
  id: z.string(),
});

export type CreateVendorDTO = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDTO = z.infer<typeof UpdateVendorSchema>;
