import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  title: z.string(),
  message: z.string(),
  type: z.string().optional().default('info'),
  userId: z.string().optional().nullable(),
});

export const UpdateNotificationSchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

export type CreateNotificationDTO = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotificationDTO = z.infer<typeof UpdateNotificationSchema>;
