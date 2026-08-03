import { CreateInventoryItemDTO, UpdateInventoryItemDTO } from '@repo/core';
import { IInventoryItemRepository, InventoryItem } from './IInventoryItemRepository';

export class InventoryItemService {
  constructor(private readonly inventoryItemRepository: IInventoryItemRepository) {}

  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.inventoryItemRepository.findManyByTenant(tenantId);
  }

  async createInventoryItem(tenantId: string, data: CreateInventoryItemDTO): Promise<InventoryItem> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.inventoryItemRepository.create(tenantId, data);
  }

  async updateInventoryItem(data: UpdateInventoryItemDTO): Promise<InventoryItem> {
    const existing = await this.inventoryItemRepository.findById(data.id);
    if (!existing) throw new Error('Item not found');
    return this.inventoryItemRepository.update(data.id, data);
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const existing = await this.inventoryItemRepository.findById(id);
    if (!existing) throw new Error('Item not found');
    return this.inventoryItemRepository.delete(id);
  }
}
