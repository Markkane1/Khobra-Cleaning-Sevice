import { CreateServiceDTO, UpdateServiceDTO } from '@repo/core';
import { IServiceRepository, Service } from './IServiceRepository';

export class ServiceService {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async getServices(tenantId: string): Promise<Service[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.serviceRepository.findManyByTenant(tenantId);
  }

  async createService(tenantId: string, data: CreateServiceDTO): Promise<Service> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.serviceRepository.create(tenantId, data);
  }

  async updateService(data: UpdateServiceDTO): Promise<Service> {
    const existing = await this.serviceRepository.findById(data.id);
    if (!existing) throw new Error('Service not found');
    return this.serviceRepository.update(data.id, data);
  }

  async deleteService(id: string): Promise<void> {
    const existing = await this.serviceRepository.findById(id);
    if (!existing) throw new Error('Service not found');
    return this.serviceRepository.delete(id);
  }
}
