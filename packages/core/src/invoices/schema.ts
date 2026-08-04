import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  bookingId: z.string().optional(),
  totalAmount: z.number().finite().positive('Invoice total must be greater than zero'),
  status: z.enum(['draft', 'issued']).default('issued'),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const UpdateInvoiceSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['draft', 'issued', 'overdue', 'cancelled']).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

export type CreateInvoiceDTO = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDTO = z.infer<typeof UpdateInvoiceSchema>;
