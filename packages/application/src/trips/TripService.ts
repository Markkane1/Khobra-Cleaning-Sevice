import { CreateTripDTO, UpdateTripDTO } from '@repo/core';
import { ITripRepository, Trip } from './ITripRepository';

export class TripService {
  constructor(private readonly tripRepository: ITripRepository) {}

  async getTrips(tenantId: string): Promise<Trip[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.tripRepository.findManyByTenant(tenantId);
  }

  async createTrip(tenantId: string, data: CreateTripDTO): Promise<Trip> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.tripRepository.create(tenantId, data);
  }

  async updateTrip(tenantId: string, data: UpdateTripDTO): Promise<Trip> {
    return this.tripRepository.update(tenantId, data.id, data);
  }

  async deleteTrip(tenantId: string, id: string): Promise<void> {
    return this.tripRepository.delete(tenantId, id);
  }
}
