import { z } from 'zod';

export const CreateLeaveSchema = z.object({
  employeeId: z.string(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  type: z.string().optional().default('Annual'),
  days: z.number().or(z.string()).optional().default(1),
  reason: z.string().optional(),
});

export const UpdateLeaveSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateLeaveDTO = z.infer<typeof CreateLeaveSchema>;
export type UpdateLeaveDTO = z.infer<typeof UpdateLeaveSchema>;
