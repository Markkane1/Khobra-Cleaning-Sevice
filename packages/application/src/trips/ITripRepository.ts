import { CreateTripDTO, UpdateTripDTO } from '@repo/core';

export interface TripStop {
  id: string;
  tripId: string;
  stopOrder: number;
  address: string;
  contactPhone?: string | null;
  status: string;
  completedAt?: Date | null;
}

export interface Trip {
  id: string;
  tenantId: string;
  driverId?: string | null;
  vehicleId?: string | null;
  status: string;
  date: Date;
  driver?: any;
  stops?: TripStop[];
  [key: string]: any;
}

export interface ITripRepository {
  findManyByTenant(tenantId: string): Promise<Trip[]>;
  findById(id: string): Promise<Trip | null>;
  create(tenantId: string, data: CreateTripDTO): Promise<Trip>;
  update(id: string, data: UpdateTripDTO): Promise<Trip>;
  delete(id: string): Promise<void>;
}
