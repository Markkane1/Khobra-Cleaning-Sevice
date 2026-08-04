import { CreateVendorItemDTO, UpdateVendorItemDTO } from '@repo/core';
import { IVendorItemRepository, VendorItem } from './IVendorItemRepository';

export class VendorItemService {
  constructor(private readonly vendorItemRepository: IVendorItemRepository) {}

  async getVendorItems(tenantId: string, vendorId?: string | null): Promise<VendorItem[]> {
    return this.vendorItemRepository.findMany(tenantId, vendorId);
  }

  async createVendorItem(tenantId: string, data: CreateVendorItemDTO): Promise<VendorItem> {
    if (!data.vendorId || !data.itemId) throw new Error('vendorId and itemId required');
    return this.vendorItemRepository.create(tenantId, data);
  }

  async updateVendorItem(tenantId: string, data: UpdateVendorItemDTO): Promise<VendorItem> {
    const existing = await this.vendorItemRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('VendorItem not found');
    return this.vendorItemRepository.update(tenantId, data.id, data);
  }

  async deleteVendorItem(tenantId: string, id: string): Promise<void> {
    const existing = await this.vendorItemRepository.findById(tenantId, id);
    if (!existing) throw new Error('VendorItem not found');
    return this.vendorItemRepository.delete(tenantId, id);
  }
}
