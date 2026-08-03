import { CreateVendorDTO, UpdateVendorDTO } from '@repo/core';
import { IVendorRepository, Vendor } from './IVendorRepository';

export class VendorService {
  constructor(private readonly vendorRepository: IVendorRepository) {}

  async getVendors(tenantId: string): Promise<Vendor[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.vendorRepository.findManyByTenant(tenantId);
  }

  async createVendor(tenantId: string, data: CreateVendorDTO): Promise<Vendor> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.vendorRepository.create(tenantId, data);
  }

  async updateVendor(data: UpdateVendorDTO): Promise<Vendor> {
    const existing = await this.vendorRepository.findById(data.id);
    if (!existing) throw new Error('Vendor not found');
    return this.vendorRepository.update(data.id, data);
  }

  async deleteVendor(id: string): Promise<void> {
    const existing = await this.vendorRepository.findById(id);
    if (!existing) throw new Error('Vendor not found');
    return this.vendorRepository.delete(id);
  }
}
