import { z } from 'zod';

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return Number.NaN;
  const str = timeStr.trim().toUpperCase();
  const is12Hour = str.includes('AM') || str.includes('PM');

  if (is12Hour) {
    if (!/^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/.test(str)) return Number.NaN;
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    const cleanTime = str.replace(/(AM|PM)/g, '').trim();
    const parts = cleanTime.split(':');
    let hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(str)) return Number.NaN;
  const parts = str.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

export function isValidTime(timeStr: string): boolean {
  return Number.isFinite(parseTimeToMinutes(timeStr));
}

export function calculateDurationHours(fromTime: string, toTime: string): number {
  const startMins = parseTimeToMinutes(fromTime);
  const endMins = parseTimeToMinutes(toTime);
  if (endMins <= startMins) return 0;
  const diffMins = endMins - startMins;
  return Math.round((diffMins / 60) * 100) / 100;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateEndTimeFromDuration(fromTime: string, durationHours: number): string {
  const startMins = parseTimeToMinutes(fromTime);
  const endMins = startMins + Math.round(durationHours * 60);
  return formatMinutesToTime(endMins);
}

/**
 * Prompt 09 Centralized Double-Booking Prevention Rule:
 * Existing Start < Requested End AND Existing End > Requested Start
 */
export function isTimeSlotOverlapping(
  existingStart: string | number,
  existingEnd: string | number,
  requestedStart: string | number,
  requestedEnd: string | number
): boolean {
  const exStart = typeof existingStart === 'number' ? existingStart : parseTimeToMinutes(existingStart);
  const exEnd = typeof existingEnd === 'number' ? existingEnd : parseTimeToMinutes(existingEnd);
  const reqStart = typeof requestedStart === 'number' ? requestedStart : parseTimeToMinutes(requestedStart);
  const reqEnd = typeof requestedEnd === 'number' ? requestedEnd : parseTimeToMinutes(requestedEnd);

  return exStart < reqEnd && exEnd > reqStart;
}

export interface ServiceItemPricing {
  serviceId: string;
  serviceName?: string;
  hourlyRate: number;
  employeeCount: number;
  hours: number;
  totalAmount: number;
  includesMaterials?: boolean;
}

export interface MaterialItemInput {
  name: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string;
  unit?: string;
}

export interface MaterialItemPricing {
  inventoryItemId?: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface MultiServicePricingResult {
  items: ServiceItemPricing[];
  materials: MaterialItemPricing[];
  labourSubtotal: number;
  materialsSubtotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  discount: number;
  netAmount: number;
}

export function calculateMultiServicePricing(
  services: Array<{ id: string; name?: string; baseRate: number; includesMaterials?: boolean }>,
  employeeCount: number = 1,
  durationHours: number = 0,
  materialsInput: MaterialItemInput[] | number = [],
  discount: number = 0,
  taxRate: number = 0
): MultiServicePricingResult {
  const validEmployeeCount = Math.max(1, Math.round(employeeCount || 1));
  const validDuration = Math.max(0, durationHours || 0);

  // 1. Calculate each service: Hourly Rate * Employee Count * Total Hours
  const items: ServiceItemPricing[] = services.map(srv => {
    const hourlyRate = srv.baseRate || 0;
    const totalAmount = Math.round((hourlyRate * validEmployeeCount * validDuration) * 100) / 100;
    return {
      serviceId: srv.id,
      serviceName: srv.name,
      hourlyRate,
      employeeCount: validEmployeeCount,
      hours: validDuration,
      totalAmount,
      includesMaterials: srv.includesMaterials,
    };
  });

  const labourSubtotal = Math.round(items.reduce((sum, item) => sum + item.totalAmount, 0) * 100) / 100;

  // 2. Calculate materials: Quantity * Unit Price
  let materials: MaterialItemPricing[] = [];
  let materialsSubtotal = 0;

  if (Array.isArray(materialsInput)) {
    materials = materialsInput.map(mat => {
      const q = Math.max(0, mat.quantity || 0);
      const p = Math.max(0, mat.unitPrice || 0);
      const totalAmount = Math.round((q * p) * 100) / 100;
      return {
        inventoryItemId: mat.inventoryItemId,
        name: mat.name,
        unit: mat.unit || 'pcs',
        quantity: q,
        unitPrice: p,
        totalAmount,
      };
    });
    materialsSubtotal = Math.round(materials.reduce((sum, mat) => sum + mat.totalAmount, 0) * 100) / 100;
  } else if (typeof materialsInput === 'number') {
    materialsSubtotal = Math.max(0, materialsInput || 0);
  }

  // 3. Subtotal = Labour Charges + Material Charges
  const subtotal = Math.round((labourSubtotal + materialsSubtotal) * 100) / 100;
  const validTaxRate = Math.max(0, taxRate || 0);
  const taxAmount = Math.round((subtotal * validTaxRate) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  const netAmount = Math.max(0, Math.round((totalAmount - (discount || 0)) * 100) / 100);

  return {
    items,
    materials,
    labourSubtotal,
    materialsSubtotal,
    subtotal,
    taxRate: validTaxRate,
    taxAmount,
    totalAmount,
    discount: discount || 0,
    netAmount,
  };
}

export const MaterialItemSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  inventoryItemId: z.string().optional(),
  unit: z.string().optional().default('pcs'),
});

export type BookingScheduleType =
  | 'one_time'
  | 'multiple_dates'
  | 'daily_recurring'
  | 'weekly_recurring'
  | 'selected_weekdays_one_time'
  | 'long_term';

export function parseLocalDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const str = String(value).trim().split('T')[0];
  if (!str) return null;
  const parts = str.split('-').map(p => parseInt(p, 10));
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function generateBookingOccurrenceDates(data: {
  scheduledDate?: string | Date;
  bookingType?: BookingScheduleType;
  selectedDates?: (string | Date)[];
  startDate?: string | Date;
  endDate?: string | Date;
  selectedWeekdays?: number[];
}): Date[] {
  const type = data.bookingType || 'one_time';

  const parseToLocal = (val?: string | Date) => {
    return parseLocalDate(val) || new Date();
  };

  if (type === 'one_time') {
    const d = parseToLocal(data.scheduledDate);
    return [d];
  }

  if (type === 'multiple_dates') {
    if (data.selectedDates && data.selectedDates.length > 0) {
      return data.selectedDates.map(d => parseToLocal(d));
    }
    const d = parseToLocal(data.scheduledDate);
    return [d];
  }

  const start = parseToLocal(data.startDate || data.scheduledDate);
  const end = parseToLocal(data.endDate || start);

  const curr = new Date(start);
  curr.setHours(0, 0, 0, 0);
  const endLimit = new Date(end);
  endLimit.setHours(23, 59, 59, 999);

  const dates: Date[] = [];
  const weekdays = data.selectedWeekdays && data.selectedWeekdays.length > 0 ? data.selectedWeekdays : [1, 2, 3, 4, 5];

  while (curr <= endLimit) {
    if (type === 'daily_recurring') {
      dates.push(new Date(curr));
    } else if (type === 'weekly_recurring' || type === 'selected_weekdays_one_time' || type === 'long_term') {
      if (weekdays.includes(curr.getDay())) {
        dates.push(new Date(curr));
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  if (dates.length === 0) {
    dates.push(new Date(start));
  }

  return dates;
}

const TimeSchema = z.string().refine(isValidTime, 'Use a valid time in HH:MM format');

const BookingDateSchema = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const dateMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];
  }
  return val;
}, z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'), z.date()]).optional());

function isPastBookingDate(value: string | Date): boolean {
  const date = parseLocalDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function isTodayBookingDate(value: string | Date): boolean {
  const date = parseLocalDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export const CreateBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  serviceId: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
  serviceOptions: z.array(z.object({ serviceId: z.string().min(1), withMaterials: z.boolean() })).optional(),
  preferredEmployeeId: z.preprocess(val => val === '' ? undefined : val, z.string().optional()),
  preferredEmployeeIds: z.array(z.string()).optional(),
  scheduledDate: BookingDateSchema,
  bookingType: z.enum(['one_time', 'multiple_dates', 'daily_recurring', 'weekly_recurring', 'selected_weekdays_one_time', 'long_term']).optional().default('one_time'),
  selectedDates: z.array(BookingDateSchema).optional(),
  startDate: BookingDateSchema,
  endDate: BookingDateSchema,
  selectedWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: TimeSchema,
  endTime: TimeSchema,
  duration: z.number().optional(),
  employeeCount: z.number().int().min(1, 'At least 1 cleaner must be assigned').optional().default(1),
  discount: z.number().optional().default(0),
  taxRate: z.number().min(0).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional().default(false),
  recurringRule: z.string().optional(),
  recurringGroupId: z.string().optional(),
  preferredPaymentMethod: z.enum(['cash', 'bank_transfer']).optional(),
}).superRefine((data, ctx) => {
  if ((data.latitude === undefined) !== (data.longitude === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Latitude and longitude must be provided together', path: ['latitude'] });
  }
  const hasServiceId = Boolean(data.serviceId);
  const hasServiceIds = Boolean(data.serviceIds && data.serviceIds.length > 0);

  if (!hasServiceId && !hasServiceIds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one service is required',
      path: ['serviceIds'],
    });
  }

  const selectedEmployeeIds = data.preferredEmployeeIds?.length ? data.preferredEmployeeIds : data.preferredEmployeeId ? [data.preferredEmployeeId] : [];
  if (selectedEmployeeIds.length && selectedEmployeeIds.length !== data.employeeCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select exactly the assigned staff count', path: ['preferredEmployeeIds'] });
  }
  if (new Set(selectedEmployeeIds).size !== selectedEmployeeIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Employees can only be selected once', path: ['preferredEmployeeIds'] });
  }
  if (data.serviceOptions) {
    const selectedServiceIds = data.serviceIds?.length ? data.serviceIds : data.serviceId ? [data.serviceId] : [];
    if (data.serviceOptions.length !== selectedServiceIds.length || data.serviceOptions.some(option => !selectedServiceIds.includes(option.serviceId)) || new Set(data.serviceOptions.map(option => option.serviceId)).size !== data.serviceOptions.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose one materials option for every selected service', path: ['serviceOptions'] });
    }
  }

  if (calculateDurationHours(data.startTime, data.endTime) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'To time must be later than From time',
      path: ['endTime'],
    });
  }

  if (data.bookingType === 'one_time' && !data.scheduledDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Booking date is required', path: ['scheduledDate'] });
  }
  if (data.bookingType === 'multiple_dates' && (!data.selectedDates || data.selectedDates.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select at least one booking date', path: ['selectedDates'] });
  }

  const bookingDates = data.bookingType === 'multiple_dates'
    ? (data.selectedDates || []).map((date, index) => ({ date, path: ['selectedDates', index] }))
    : ['daily_recurring', 'weekly_recurring', 'selected_weekdays_one_time', 'long_term'].includes(data.bookingType)
      ? [{ date: data.startDate, path: ['startDate'] }, { date: data.endDate, path: ['endDate'] }]
      : [{ date: data.scheduledDate, path: ['scheduledDate'] }];
  bookingDates.forEach(({ date, path }) => {
    if (date && isPastBookingDate(date)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Booking dates cannot be in the past', path });
    }
  });

  const occurrenceDates = bookingDates.every(({ date }) => date)
    ? generateBookingOccurrenceDates({
        ...data,
        selectedDates: data.selectedDates ? data.selectedDates.filter((d): d is string | Date => Boolean(d)) : undefined,
      })
    : [];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (occurrenceDates.some(isTodayBookingDate) && parseTimeToMinutes(data.startTime) < currentMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start time cannot be in the past', path: ['startTime'] });
  }

  if (['daily_recurring', 'weekly_recurring', 'selected_weekdays_one_time', 'long_term'].includes(data.bookingType)) {
    if (!data.startDate || !data.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Recurring bookings require a start and end date', path: ['endDate'] });
    } else if (new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be on or after start date', path: ['endDate'] });
    }
    if (['weekly_recurring', 'selected_weekdays_one_time', 'long_term'].includes(data.bookingType) && (!data.selectedWeekdays || data.selectedWeekdays.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select at least one weekday', path: ['selectedWeekdays'] });
    }
  }
});

export const PublicBookingSchema = z.object({
  serviceId: z.string().min(1, 'Choose a service'),
  withMaterials: z.boolean(),
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(24),
  scheduledDate: z.string().date('Choose a valid booking date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a valid start time'),
  duration: z.number().int().min(2).max(8),
  employeeCount: z.number().int().min(1).max(10),
  address: z.string().trim().max(250).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(80),
  area: z.string().trim().max(80).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
  preferredPaymentMethod: z.enum(['cash', 'bank_transfer']),
}).strict().superRefine((data, ctx) => {
  const hasLatitude = data.latitude !== undefined;
  const hasLongitude = data.longitude !== undefined;
  if (!data.address && !(hasLatitude && hasLongitude)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a service address or use your current location', path: ['address'] });
  }
  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Latitude and longitude must be provided together', path: ['latitude'] });
  }
});

export const BOOKING_STATUS_KEYS = [
  'pending_assignment',
  'assigned',
  'scheduled',
  'on_the_way',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type BookingStatusKey = typeof BOOKING_STATUS_KEYS[number];

const normalizeBookingStatus = (status: string) => status === 'pending' ? 'pending_assignment' : status === 'confirmed' ? 'scheduled' : status;

export const isTerminalBookingStatus = (status: string) => ['completed', 'cancelled', 'no_show'].includes(normalizeBookingStatus(status));

export function canDriverTransitionToOnTheWay(currentStatus: string, targetStatus: string | undefined, assignedDriverId: string | null, actingDriverId: string | undefined): boolean {
  return Boolean(actingDriverId && assignedDriverId === actingDriverId && normalizeBookingStatus(currentStatus) === 'scheduled' && targetStatus === 'on_the_way');
}

export function canCleanerStartWork(currentStatus: string, targetStatus: string | undefined, assignedCleanerIds: string[], actingCleanerId: string | undefined): boolean {
  return Boolean(actingCleanerId && assignedCleanerIds.includes(actingCleanerId) && currentStatus === 'on_the_way' && targetStatus === 'in_progress');
}

export function canCleanerSubmitCompletionTiming(currentStatus: string, assignedCleanerIds: string[], actingCleanerId: string | undefined): boolean {
  return Boolean(actingCleanerId && assignedCleanerIds.includes(actingCleanerId) && currentStatus === 'in_progress');
}

export function canCleanerCompleteBooking(currentStatus: string, targetStatus: string | undefined, assignedCleanerIds: string[], actingCleanerId: string | undefined): boolean {
  return Boolean(actingCleanerId && assignedCleanerIds.includes(actingCleanerId) && normalizeBookingStatus(currentStatus) === 'in_progress' && (!targetStatus || normalizeBookingStatus(targetStatus) === 'completed'));
}

export const CleanerCompleteBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  notes: z.string().optional(),
});

export const shouldGeneratePickupAlert = (previous: boolean | undefined, current: boolean) => current && previous !== true;

export function isValidStatusTransition(currentStatus: string, targetStatus: string): boolean {
  if (currentStatus === targetStatus) return true;

  const curr = normalizeBookingStatus(currentStatus);
  const target = normalizeBookingStatus(targetStatus);

  if (curr === target) return true;

  const allowed: Record<string, string[]> = {
    pending_assignment: ['assigned', 'cancelled'],
    assigned: ['scheduled', 'cancelled'],
    scheduled: ['on_the_way', 'cancelled', 'no_show'],
    on_the_way: ['in_progress', 'cancelled', 'no_show'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
  };

  return allowed[curr]?.includes(target) ?? false;
}

export const UpdateBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  customerId: z.string().min(1, 'Customer ID is required').optional(),
  driverId: z.string().min(1, 'Driver ID is required').nullable().optional(),
  serviceId: z.string().min(1, 'Service ID is required').optional(),
  serviceIds: z.array(z.string().min(1, 'Service ID is required')).optional(),
  serviceOptions: z.array(z.object({ serviceId: z.string().min(1), withMaterials: z.boolean() })).optional(),
  preferredEmployeeId: z.string().min(1, 'Cleaner ID is required').optional(),
  scheduledDate: BookingDateSchema.optional(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  duration: z.number().positive('Duration must be greater than zero').optional(),
  employeeCount: z.number().int().min(1).optional(),
  status: z.enum(BOOKING_STATUS_KEYS).optional(),
  cancellationReason: z.string().optional(),
  noShowReason: z.string().optional(),
  noShowParty: z.enum(['customer', 'cleaner']).optional(),
  discount: z.number().nonnegative('Discount cannot be negative').optional(),
  taxRate: z.number().min(0).max(1, 'Tax rate cannot exceed 100%').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringRule: z.string().optional(),
}).superRefine((data, ctx) => {
  if ((data.latitude == null) !== (data.longitude == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Latitude and longitude must be provided together', path: ['latitude'] });
  }
  if (data.serviceIds && data.serviceIds.length === 0 && !data.serviceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one service is required',
      path: ['serviceIds'],
    });
  }
  if (data.serviceOptions && data.serviceIds && (data.serviceOptions.length !== data.serviceIds.length || data.serviceOptions.some(option => !data.serviceIds!.includes(option.serviceId)))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose one materials option for every selected service', path: ['serviceOptions'] });
  }
  if (data.startTime && data.endTime) {
    const duration = calculateDurationHours(data.startTime, data.endTime);
    if (duration <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'To time must be later than From time',
        path: ['endTime'],
      });
    }
  }
  if (data.status === 'cancelled' && !data.cancellationReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cancellation reason is required', path: ['cancellationReason'] });
  }
  if (data.status === 'no_show' && !data.noShowReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No-show reason is required', path: ['noShowReason'] });
  }
});

export type CreateBookingDTO = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingDTO = z.infer<typeof UpdateBookingSchema>;

export const CompletionTimingResponseSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  withinScheduledTime: z.boolean(),
});

export const AssignEmployeesSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  employeeIds: z.array(z.string()).refine(ids => new Set(ids).size === ids.length, 'Each cleaner can only be assigned once').optional().default([]),
  driverId: z.string().min(1, 'Driver is required'),
  autoAssign: z.boolean().optional().default(false),
});

export type AssignEmployeesDTO = z.infer<typeof AssignEmployeesSchema>;

export const ALLOWED_RATINGS = [1, 2, 3, 4, 5] as const;

export function isValidRating(rating: number): boolean {
  return ALLOWED_RATINGS.includes(rating as any);
}

export const RateEmployeeInputSchema = z.object({
  assignmentId: z.string().optional(),
  employeeId: z.string().min(1, 'Cleaner ID is required'),
  rating: z.number().refine(val => isValidRating(val), {
    message: 'Rating must be a whole number from 1 to 5',
  }),
  notes: z.string().trim().max(500).optional(),
});

export const RateBookingEmployeesSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  overallRating: z.number().refine(val => isValidRating(val), {
    message: 'Overall rating must be a whole number from 1 to 5',
  }),
  overallComment: z.string().trim().max(2000).optional(),
  ratings: z.array(RateEmployeeInputSchema).min(1, 'At least one rating is required'),
}).superRefine((data, ctx) => {
  const employeeIds = data.ratings.map(rating => rating.employeeId);
  if (new Set(employeeIds).size !== employeeIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each cleaner may be rated only once', path: ['ratings'] });
});

export function canCustomerRateBooking(bookingStatus: string, hasAlreadyRated: boolean): boolean {
  return normalizeBookingStatus(bookingStatus) === 'completed' && !hasAlreadyRated;
}

export type RateEmployeeInput = z.infer<typeof RateEmployeeInputSchema>;
export type RateBookingEmployeesDTO = z.infer<typeof RateBookingEmployeesSchema>;

/**
 * Prompt 16 Final Booking Confirmation Validation Pipeline
 */
export function validateBookingConfirmationDTO(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Service Selection
  const serviceIds = data.serviceIds || (data.serviceId ? [data.serviceId] : []);
  if (!serviceIds || serviceIds.length === 0) {
    errors.push('Customer must select at least one service');
  }

  // 2. Booking Date & Recurrence Configuration
  const hasDate = Boolean(data.scheduledDate || data.startDate || (data.selectedDates && data.selectedDates.length > 0));
  if (!hasDate) {
    errors.push('Booking date is required and must be valid');
  }

  // 3 & 4. From / To Time Validation
  if (!data.startTime) {
    errors.push('From time is required');
  }

  // 5 & 6. Time Window & Duration Calculation Correctness
  if (!data.endTime) {
    errors.push('To time is required');
  } else if (!isValidTime(data.startTime) || !isValidTime(data.endTime) || calculateDurationHours(data.startTime, data.endTime) <= 0) {
    errors.push('To time must be later than From time');
  }

  // 8. Employee Count Validation
  if (data.employeeCount !== undefined && data.employeeCount < 1) {
    errors.push('Employee count must be at least 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Prompt 18 Admin-Configurable Daily Booking Hours Validation
 */
export function validateBookingHours(
  startTime: string,
  endTime: string,
  firstBookingTime: string = '08:00',
  lastWorkingTime: string = '20:00'
): { isValid: boolean; error?: string } {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  const openMins = parseTimeToMinutes(firstBookingTime);
  const closeMins = parseTimeToMinutes(lastWorkingTime);

  if (![startMins, endMins, openMins, closeMins].every(Number.isFinite)) {
    return { isValid: false, error: 'Booking and business hours must use valid times' };
  }

  if (closeMins <= openMins) {
    return { isValid: false, error: 'Invalid business hours configuration: Last working time must be later than First booking start time' };
  }

  if (startMins < openMins) {
    return { isValid: false, error: `Booking start time (${startTime}) cannot be earlier than business opening time (${firstBookingTime})` };
  }

  if (endMins > closeMins) {
    return { isValid: false, error: `Booking end time (${endTime}) cannot be later than last working time (${lastWorkingTime})` };
  }

  if (endMins <= startMins) {
    return { isValid: false, error: 'Booking end time must be later than start time' };
  }

  return { isValid: true };
}
