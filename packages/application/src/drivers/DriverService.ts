import { CreateDriverDTO, UpdateDriverDTO } from '@repo/core/src/drivers/schema';
import { IDriverRepository, Driver } from './IDriverRepository';

export class DriverService {
  constructor(private readonly driverRepository: IDriverRepository) {}

  async getDrivers(tenantId: string): Promise<Driver[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.driverRepository.findManyByTenant(tenantId);
  }

  async createDriver(tenantId: string, data: CreateDriverDTO): Promise<Driver> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.driverRepository.create(tenantId, data);
  }

  async updateDriver(tenantId: string, data: UpdateDriverDTO): Promise<Driver> {
    const existing = await this.driverRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Driver not found');
    return this.driverRepository.update(tenantId, data.id, data);
  }

  async deleteDriver(tenantId: string, id: string): Promise<void> {
    const existing = await this.driverRepository.findById(tenantId, id);
    if (!existing) throw new Error('Driver not found');
    return this.driverRepository.delete(tenantId, id);
  }
}
