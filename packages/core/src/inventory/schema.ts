import { z } from 'zod';

export const CreateInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required'),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().optional(),
  currentStock: z.coerce.number().nonnegative('Current stock cannot be negative').optional(),
  minStock: z.coerce.number().nonnegative('Minimum stock cannot be negative').optional(),
  costPrice: z.coerce.number().nonnegative('Cost price cannot be negative').optional(),
  sellPrice: z.coerce.number().nonnegative('Selling price cannot be negative').optional(),
  status: z.string().optional(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial().extend({
  id: z.string().min(1, 'Item ID is required'),
  adjustQuantity: z.coerce.number().positive('Adjustment quantity must be greater than zero').optional(),
  adjustType: z.enum(['IN', 'OUT']).optional(),
  notes: z.string().optional(),
});

export type CreateInventoryItemDTO = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemDTO = z.infer<typeof UpdateInventoryItemSchema>;
