import { z } from 'zod';

export const CreateAttendanceSchema = z.object({
  employeeId: z.string().min(1, 'Cleaner is required'),
  date: z.coerce.date('Attendance date is invalid'),
  clockIn: z.coerce.date('Clock-in time is invalid').optional(),
  clockOut: z.coerce.date('Clock-out time is invalid').optional(),
  status: z.string().default('present'),
  notes: z.string().optional(),
});

export type CreateAttendanceDTO = z.infer<typeof CreateAttendanceSchema>;

export const UpdateAttendanceSchema = z.object({
  id: z.string().min(1, 'Attendance record ID is required'),
  date: z.coerce.date('Attendance date is invalid').optional(),
  clockIn: z.coerce.date('Clock-in time is invalid').optional(),
  clockOut: z.coerce.date('Clock-out time is invalid').optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateAttendanceDTO = z.infer<typeof UpdateAttendanceSchema>;
