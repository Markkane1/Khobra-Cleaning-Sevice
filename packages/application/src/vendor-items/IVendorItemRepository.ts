import { CreateVendorItemDTO, UpdateVendorItemDTO } from '@repo/core';

export interface VendorItem {
  id: string;
  vendorId: string;
  itemId: string;
  unitCost: number;
  leadTimeDays: number;
  vendor?: { name: string };
  item?: { name: string; sku?: string | null; unit?: string | null };
}

export interface IVendorItemRepository {
  findMany(vendorId?: string | null): Promise<VendorItem[]>;
  findById(id: string): Promise<VendorItem | null>;
  create(data: CreateVendorItemDTO): Promise<VendorItem>;
  update(id: string, data: UpdateVendorItemDTO): Promise<VendorItem>;
  delete(id: string): Promise<void>;
}
