import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  totalAmount: z.number(),
}).catchall(z.any());

export const UpdateInvoiceSchema = z.object({
  id: z.string(),
}).catchall(z.any());

export type CreateInvoiceDTO = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDTO = z.infer<typeof UpdateInvoiceSchema>;
