import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string().optional(),
}).catchall(z.any());

export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;
