import { z } from 'zod';

export const TripStopSchema = z.object({
  id: z.string().optional(),
  address: z.string(),
  contactPhone: z.string().nullable().optional(),
  status: z.string().optional(),
  completedAt: z.string().or(z.date()).optional(),
  type: z.string().optional(),
});

export const CreateTripSchema = z.object({
  driverId: z.string(),
  date: z.string().or(z.date()),
  status: z.string().optional(),
  startMileage: z.number().optional(),
  endMileage: z.number().optional(),
  fuelCost: z.number().optional(),
  notes: z.string().optional(),
  stops: z.array(TripStopSchema).optional(),
});

const UpdateTripStopSchema = TripStopSchema.partial().extend({
  id: z.string(),
});

export const UpdateTripSchema = CreateTripSchema.partial().extend({
  id: z.string(),
  stops: z.array(UpdateTripStopSchema).optional(),
});

export type CreateTripDTO = z.infer<typeof CreateTripSchema>;
export type UpdateTripDTO = z.infer<typeof UpdateTripSchema>;
