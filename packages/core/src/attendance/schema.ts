import { z } from 'zod';

export const CreateAttendanceSchema = z.object({
  employeeId: z.string(),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  clockIn: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  clockOut: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  status: z.string().default('present'),
  notes: z.string().optional(),
});

export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;

export const UpdateAttendanceSchema = z.object({
  id: z.string(),
  date: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  clockIn: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  clockOut: z.string().or(z.date()).optional().transform((val) => val ? new Date(val) : undefined),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateAttendanceDTO = z.infer<typeof UpdateAttendanceSchema>;
