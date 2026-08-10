import { z } from 'zod';

export const CreateVendorItemSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  itemId: z.string().min(1, 'Inventory item is required'),
  unitCost: z.coerce.number().nonnegative('Unit cost cannot be negative').optional(),
  leadTimeDays: z.coerce.number().int().nonnegative('Lead time cannot be negative').optional(),
});

export const UpdateVendorItemSchema = CreateVendorItemSchema.partial().extend({
  id: z.string().min(1, 'Vendor item ID is required'),
});

export type CreateVendorItemDTO = z.infer<typeof CreateVendorItemSchema>;
export type UpdateVendorItemDTO = z.infer<typeof UpdateVendorItemSchema>;
