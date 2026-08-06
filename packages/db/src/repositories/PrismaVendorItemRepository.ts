import { PrismaClient } from '@prisma/client';
import { IVendorItemRepository, VendorItem } from '@repo/application';
import { CreateVendorItemDTO, UpdateVendorItemDTO } from '@repo/core';

export class PrismaVendorItemRepository implements IVendorItemRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(tenantId: string, vendorId?: string | null): Promise<VendorItem[]> {
    return this.db.vendorItem.findMany({
      where: { ...(vendorId ? { vendorId } : {}), vendor: { tenantId } },
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as VendorItem[];
  }

  async findById(tenantId: string, id: string): Promise<VendorItem | null> {
    return this.db.vendorItem.findFirst({
      where: { id, vendor: { tenantId } },
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true, unit: true } },
      },
    }) as unknown as VendorItem | null;
  }

  async create(tenantId: string, data: CreateVendorItemDTO): Promise<VendorItem> {
    const [vendor, item] = await Promise.all([
      this.db.vendor.findFirst({ where: { id: data.vendorId, tenantId }, select: { id: true } }),
      this.db.inventoryItem.findFirst({ where: { id: data.itemId, tenantId }, select: { id: true } }),
    ]);
    if (!vendor || !item) throw new Error('Vendor or inventory item not found');
    return this.db.vendorItem.create({
      data: {
        vendorId: data.vendorId,
        itemId: data.itemId,
        unitPrice: data.unitCost || 0,
        leadTimeDays: data.leadTimeDays || 0,
      },
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true } },
      },
    }) as unknown as VendorItem;
  }

  async update(tenantId: string, id: string, data: UpdateVendorItemDTO): Promise<VendorItem> {
    if (!await this.findById(tenantId, id)) throw new Error('VendorItem not found');
    const { id: _id, ...updateData } = data;
    return this.db.vendorItem.update({
      where: { id, vendor: { tenantId } },
      data: {
        unitPrice: updateData.unitCost,
        leadTimeDays: updateData.leadTimeDays,
      },
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true, unit: true } },
      },
    }) as unknown as VendorItem;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    if (!await this.findById(tenantId, id)) throw new Error('VendorItem not found');
    await this.db.vendorItem.delete({ where: { id, vendor: { tenantId } } });
  }
}
