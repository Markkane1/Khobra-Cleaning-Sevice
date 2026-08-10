import { z } from 'zod';

export const CreateComplaintSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required').optional(),
  bookingId: z.string().min(1, 'Booking ID is required').optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
  description: z.string().trim().min(5, 'Describe the issue in at least 5 characters').max(2000),
  resolution: z.string().optional(),
  attachments: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedAt: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
});

export type CreateComplaintDTO = z.infer<typeof CreateComplaintSchema>;

export const UpdateComplaintSchema = z.object({
  id: z.string().min(1, 'Complaint ID is required'),
  customerId: z.string().min(1, 'Customer ID is required').optional(),
  bookingId: z.string().min(1, 'Booking ID is required').optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  resolution: z.string().optional(),
  attachments: z.string().optional(),
  assignedTo: z.string().optional(),
  resolvedAt: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
});

export type UpdateComplaintDTO = z.infer<typeof UpdateComplaintSchema>;
