import { z } from 'zod';
import { isValidTime, parseTimeToMinutes } from '../bookings/schema.ts';

export const UpdateSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  slug: z.string().trim().min(1, 'Slug is required').max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens').optional(),
  currency: z.string().trim().length(3, 'Currency must be a 3-letter code').transform(value => value.toUpperCase()).optional(),
  locale: z.string().trim().min(2, 'Locale is required').max(35).optional(),
  timezone: z.string().trim().min(1, 'Timezone is required').max(100).optional(),
  taxRate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(1, 'Tax rate cannot exceed 100%').optional(),
  firstBookingTime: z.string().refine(isValidTime, 'Use a valid time in HH:MM format').optional(),
  lastWorkingTime: z.string().refine(isValidTime, 'Use a valid time in HH:MM format').optional(),
  logoUrl: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
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
