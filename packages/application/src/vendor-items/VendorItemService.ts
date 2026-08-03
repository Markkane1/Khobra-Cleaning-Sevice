import { CreateVendorItemDTO, UpdateVendorItemDTO } from '@repo/core';
import { IVendorItemRepository, VendorItem } from './IVendorItemRepository';

export class VendorItemService {
  constructor(private readonly vendorItemRepository: IVendorItemRepository) {}

  async getVendorItems(vendorId?: string | null): Promise<VendorItem[]> {
    return this.vendorItemRepository.findMany(vendorId);
  }

  async createVendorItem(data: CreateVendorItemDTO): Promise<VendorItem> {
    if (!data.vendorId || !data.itemId) throw new Error('vendorId and itemId required');
    return this.vendorItemRepository.create(data);
  }

  async updateVendorItem(data: UpdateVendorItemDTO): Promise<VendorItem> {
    const existing = await this.vendorItemRepository.findById(data.id);
    if (!existing) throw new Error('VendorItem not found');
    return this.vendorItemRepository.update(data.id, data);
  }

  async deleteVendorItem(id: string): Promise<void> {
    const existing = await this.vendorItemRepository.findById(id);
    if (!existing) throw new Error('VendorItem not found');
    return this.vendorItemRepository.delete(id);
  }
}
