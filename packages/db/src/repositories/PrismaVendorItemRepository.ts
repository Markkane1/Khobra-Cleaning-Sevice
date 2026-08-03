import { PrismaClient } from '@prisma/client';
import { IVendorItemRepository, VendorItem } from '@repo/application';
import { CreateVendorItemDTO, UpdateVendorItemDTO } from '@repo/core';

export class PrismaVendorItemRepository implements IVendorItemRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(vendorId?: string | null): Promise<VendorItem[]> {
    return this.db.vendorItem.findMany({
      where: vendorId ? { vendorId } : {},
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as VendorItem[];
  }

  async findById(id: string): Promise<VendorItem | null> {
    return this.db.vendorItem.findUnique({
      where: { id },
      include: {
        vendor: { select: { name: true } },
        item: { select: { name: true, sku: true, unit: true } },
      },
    }) as unknown as VendorItem | null;
  }

  async create(data: CreateVendorItemDTO): Promise<VendorItem> {
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

  async update(id: string, data: UpdateVendorItemDTO): Promise<VendorItem> {
    const { id: _id, ...updateData } = data;
    return this.db.vendorItem.update({
      where: { id },
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

  async delete(id: string): Promise<void> {
    await this.db.vendorItem.delete({ where: { id } });
  }
}
