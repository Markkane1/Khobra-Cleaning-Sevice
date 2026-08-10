import { z } from 'zod';

export const TripStopSchema = z.object({
  id: z.string().optional(),
  address: z.string().trim().min(1, 'Stop address is required'),
  contactPhone: z.string().nullable().optional(),
  status: z.string().optional(),
  completedAt: z.coerce.date('Completion date is invalid').optional(),
  type: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const CreateTripSchema = z.object({
  driverId: z.string().min(1, 'Driver is required'),
  date: z.coerce.date('Trip date is invalid'),
  status: z.string().optional(),
  startMileage: z.coerce.number().nonnegative('Start mileage cannot be negative').optional(),
  endMileage: z.coerce.number().nonnegative('End mileage cannot be negative').optional(),
  fuelCost: z.coerce.number().nonnegative('Fuel cost cannot be negative').optional(),
  notes: z.string().optional(),
  stops: z.array(TripStopSchema).optional(),
});

const UpdateTripStopSchema = TripStopSchema.partial().extend({
  id: z.string().min(1, 'Trip stop ID is required'),
});

export const UpdateTripSchema = CreateTripSchema.partial().extend({
  id: z.string().min(1, 'Trip ID is required'),
  stops: z.array(UpdateTripStopSchema).optional(),
});

export type CreateTripDTO = z.infer<typeof CreateTripSchema>;
export type UpdateTripDTO = z.infer<typeof UpdateTripSchema>;
