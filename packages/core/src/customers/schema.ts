import { z } from 'zod';
import { EmailSchema } from '../email.ts';

export const CustomerAddressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  address: z.string().trim().max(250).optional().default(''),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).superRefine((data, ctx) => {
  const hasLatitude = data.latitude !== undefined;
  const hasLongitude = data.longitude !== undefined;
  if (!data.address && !(hasLatitude && hasLongitude)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an address or use your current location', path: ['address'] });
  }
  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Latitude and longitude must be provided together', path: ['latitude'] });
  }
});

export function getPrimaryCustomerAddress(addresses: unknown, legacyAddress?: string | null) {
  const parsed = z.array(CustomerAddressSchema).safeParse(addresses);
  const primary = parsed.success ? parsed.data[0] : undefined;
  return primary?.address || (primary?.latitude !== undefined && primary?.longitude !== undefined ? 'Pinned GPS location' : legacyAddress?.trim() || '');
}

export const CreateCustomerSchema = z.object({
  email: EmailSchema,
  name: z.string().trim().min(1, 'Full name is required'),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  addresses: z.array(CustomerAddressSchema).max(10).optional(),
  notes: z.string().optional(),
  preferences: z.string().max(5000).optional(),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters'),
});

export const UpdateCustomerSchema = CreateCustomerSchema.omit({ temporaryPassword: true }).extend({
  id: z.string().min(1, 'Customer ID is required'),
});

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDTO = z.infer<typeof UpdateCustomerSchema>;
