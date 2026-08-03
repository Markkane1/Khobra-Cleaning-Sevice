import { CreateInventoryItemDTO, UpdateInventoryItemDTO } from '@repo/core';

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  sellPrice: number;
  status: string;
  movements?: any[];
}

export interface IInventoryItemRepository {
  findManyByTenant(tenantId: string): Promise<InventoryItem[]>;
  findById(id: string): Promise<InventoryItem | null>;
  create(tenantId: string, data: CreateInventoryItemDTO): Promise<InventoryItem>;
  update(id: string, data: UpdateInventoryItemDTO): Promise<InventoryItem>;
  delete(id: string): Promise<void>;
}
