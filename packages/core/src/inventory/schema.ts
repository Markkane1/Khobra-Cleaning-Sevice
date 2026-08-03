import { z } from 'zod';

export const CreateInventoryItemSchema = z.object({
  name: z.string(),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().optional(),
  currentStock: z.number().or(z.string().transform(Number)).optional(),
  minStock: z.number().or(z.string().transform(Number)).optional(),
  costPrice: z.number().or(z.string().transform(Number)).optional(),
  sellPrice: z.number().or(z.string().transform(Number)).optional(),
  status: z.string().optional(),
});

export const UpdateInventoryItemSchema = CreateInventoryItemSchema.partial().extend({
  id: z.string(),
  adjustQuantity: z.number().or(z.string().transform(Number)).optional(),
  adjustType: z.enum(['IN', 'OUT']).optional(),
  notes: z.string().optional(),
});

export type CreateInventoryItemDTO = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemDTO = z.infer<typeof UpdateInventoryItemSchema>;
