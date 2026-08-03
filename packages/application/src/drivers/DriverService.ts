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

  async updateDriver(data: UpdateDriverDTO): Promise<Driver> {
    const existing = await this.driverRepository.findById(data.id);
    if (!existing) throw new Error('Driver not found');
    return this.driverRepository.update(data.id, data);
  }

  async deleteDriver(id: string): Promise<void> {
    const existing = await this.driverRepository.findById(id);
    if (!existing) throw new Error('Driver not found');
    return this.driverRepository.delete(id);
  }
}
