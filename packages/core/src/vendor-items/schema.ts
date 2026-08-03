import { z } from 'zod';

export const CreateVendorItemSchema = z.object({
  vendorId: z.string(),
  itemId: z.string(),
  unitCost: z.number().or(z.string().transform(Number)).optional(),
  leadTimeDays: z.number().or(z.string().transform(Number)).optional(),
});

// Since the route doesn't have a PUT for vendor-items, we don't strictly need an UpdateVendorItemSchema,
// but it's good practice to provide one just in case.
export const UpdateVendorItemSchema = CreateVendorItemSchema.partial().extend({
  id: z.string(),
});

export type CreateVendorItemDTO = z.infer<typeof CreateVendorItemSchema>;
export type UpdateVendorItemDTO = z.infer<typeof UpdateVendorItemSchema>;
