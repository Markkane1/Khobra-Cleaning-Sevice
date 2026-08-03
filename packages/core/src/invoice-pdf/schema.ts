import { z } from 'zod';

export const InvoicePdfSchema = z.object({
  id: z.string(),
});
