import { z } from 'zod';

export const CreateLeaveSchema = z.object({
  employeeId: z.string().min(1, 'Cleaner is required'),
  startDate: z.coerce.date('Start date is invalid'),
  endDate: z.coerce.date('End date is invalid'),
  type: z.string().optional().default('Annual'),
  days: z.coerce.number().positive('Leave days must be greater than zero').optional().default(1),
  reason: z.string().optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

export const UpdateLeaveSchema = z.object({
  id: z.string().min(1, 'Leave record ID is required'),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateLeaveDTO = z.infer<typeof CreateLeaveSchema>;
export type UpdateLeaveDTO = z.infer<typeof UpdateLeaveSchema>;
