import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  type: z.enum(['info', 'success', 'warning', 'error', 'urgent']).optional().default('info'),
  userId: z.string().min(1).optional().nullable(),
});

export const UpdateNotificationSchema = z.object({
  id: z.string().min(1, 'Notification ID is required').optional(),
  markAllRead: z.boolean().optional(),
}).refine(data => data.markAllRead || Boolean(data.id), { message: 'Notification ID is required', path: ['id'] });

export type CreateNotificationDTO = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotificationDTO = z.infer<typeof UpdateNotificationSchema>;
