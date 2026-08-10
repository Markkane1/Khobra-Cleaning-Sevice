import { PrismaClient } from '@prisma/client';
import { IInventoryItemRepository, InventoryItem } from '@repo/application';
import { CreateInventoryItemDTO, UpdateInventoryItemDTO } from '@repo/core';

export class PrismaInventoryItemRepository implements IInventoryItemRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<InventoryItem[]> {
    return this.db.inventoryItem.findMany({
      where: { tenantId },
      include: { movements: { take: 10, orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    }) as unknown as InventoryItem[];
  }

  async findById(tenantId: string, id: string): Promise<InventoryItem | null> {
    return this.db.inventoryItem.findFirst({
      where: { id, tenantId },
    }) as unknown as InventoryItem | null;
  }

  async create(tenantId: string, data: CreateInventoryItemDTO): Promise<InventoryItem> {
    const item = await this.db.inventoryItem.create({
      data: {
        tenantId,
        name: data.name,
        sku: data.sku,
        category: data.category,
        unit: data.unit,
        currentStock: data.currentStock,
        minStock: data.minStock,
        costPrice: data.costPrice,
        status: data.status,
      },
      include: { movements: true },
    });

    if (data.currentStock && data.currentStock > 0) {
      await this.db.stockMovement.create({
        data: {
          tenantId,
          itemId: item.id,
          type: 'IN',
          quantity: data.currentStock,
          notes: 'Initial Stock Onboarding',
        },
      });
    }

    return item as unknown as InventoryItem;
  }

  async update(tenantId: string, id: string, data: UpdateInventoryItemDTO): Promise<InventoryItem> {
    const existing = await this.db.inventoryItem.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Item not found');

    let newStock = existing.currentStock;
    if (data.adjustQuantity && data.adjustType) {
      const qty = Number(data.adjustQuantity);
      if (data.adjustType === 'IN') {
        newStock += qty;
      } else if (data.adjustType === 'OUT') {
        newStock = Math.max(0, newStock - qty);
      }

      await this.db.stockMovement.create({
        data: {
          tenantId: existing.tenantId,
          itemId: id,
          type: data.adjustType,
          quantity: qty,
          notes: data.notes || `Stock adjustment (${data.adjustType})`,
        },
      });
    }

    const { id: _id, adjustQuantity, adjustType, notes, ...updateData } = data;

    return this.db.inventoryItem.update({
      where: { id, tenantId },
      data: {
        ...updateData,
        currentStock: newStock,
      },
      include: { movements: { take: 10, orderBy: { createdAt: 'desc' } } },
    }) as unknown as InventoryItem;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const item = await this.db.inventoryItem.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!item) throw new Error('Item not found');
    await this.db.$transaction([
      this.db.vendorItem.deleteMany({ where: { itemId: id } }),
      this.db.stockMovement.deleteMany({ where: { itemId: id } }),
      this.db.inventoryItem.delete({ where: { id, tenantId } }),
    ]);
  }
}
