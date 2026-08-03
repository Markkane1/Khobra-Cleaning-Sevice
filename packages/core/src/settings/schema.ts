import { z } from 'zod';
import { isValidTime, parseTimeToMinutes } from '../bookings/schema';

export const UpdateSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z.string().min(1, 'Slug is required').optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  taxRate: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? Number(val) : undefined),
  firstBookingTime: z.string().refine(isValidTime, 'Use a valid time in HH:MM format').optional(),
  lastWorkingTime: z.string().refine(isValidTime, 'Use a valid time in HH:MM format').optional(),
  logoUrl: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
}).refine(data => {
  if (data.firstBookingTime && data.lastWorkingTime) {
    const startMins = parseTimeToMinutes(data.firstBookingTime);
    const endMins = parseTimeToMinutes(data.lastWorkingTime);
    return endMins > startMins;
  }
  return true;
}, {
  message: 'Last working time must be later than First booking start time',
  path: ['lastWorkingTime'],
});

export type UpdateSettingsDTO = z.infer<typeof UpdateSettingsSchema>;
