import { z } from 'zod';

export const CustomerAddressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  address: z.string().trim().min(1),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
});

export const CreateCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  addresses: z.array(CustomerAddressSchema).max(10).optional(),
  notes: z.string().optional(),
  preferences: z.any().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.extend({
  id: z.string(),
});

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDTO = z.infer<typeof UpdateCustomerSchema>;
