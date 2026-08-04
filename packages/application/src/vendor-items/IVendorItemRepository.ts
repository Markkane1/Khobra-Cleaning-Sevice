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
  findMany(tenantId: string, vendorId?: string | null): Promise<VendorItem[]>;
  findById(tenantId: string, id: string): Promise<VendorItem | null>;
  create(tenantId: string, data: CreateVendorItemDTO): Promise<VendorItem>;
  update(tenantId: string, id: string, data: UpdateVendorItemDTO): Promise<VendorItem>;
  delete(tenantId: string, id: string): Promise<void>;
}
