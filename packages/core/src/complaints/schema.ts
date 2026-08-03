import { z } from 'zod';

export const CreateComplaintSchema = z.object({
  customerId: z.string().optional(),
  bookingId: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().default('medium'),
  status: z.string().default('open'),
  description: z.string(),
  resolution: z.string().optional(),
  attachments: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedAt: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
});

export type CreateComplaintDTO = z.infer<typeof CreateComplaintSchema>;

export const UpdateComplaintSchema = z.object({
  id: z.string(),
  customerId: z.string().optional(),
  bookingId: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  resolution: z.string().optional(),
  attachments: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedAt: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
});

export type UpdateComplaintDTO = z.infer<typeof UpdateComplaintSchema>;
