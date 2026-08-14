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
    return this.db.$transaction(async tx => {
      const item = await tx.inventoryItem.create({
        data: { tenantId, name: data.name, sku: data.sku, category: data.category, unit: data.unit, currentStock: data.currentStock, minStock: data.minStock, costPrice: data.costPrice, status: data.status },
      });
      if (data.currentStock && data.currentStock > 0) await tx.stockMovement.create({
        data: { tenantId, itemId: item.id, type: 'IN', quantity: data.currentStock, notes: 'Initial Stock Onboarding' },
      });
      return tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id }, include: { movements: true } });
    }) as unknown as InventoryItem;
  }

  async update(tenantId: string, id: string, data: UpdateInventoryItemDTO): Promise<InventoryItem> {
    const { id: _id, adjustQuantity, adjustType, notes, ...updateData } = data;
    return this.db.$transaction(async tx => {
      const existing = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
      if (!existing) throw new Error('Item not found');
      if (adjustQuantity && adjustType) {
        const qty = Number(adjustQuantity);
        const changed = await tx.inventoryItem.updateMany({
          where: { id, tenantId, ...(adjustType === 'OUT' ? { currentStock: { gte: qty } } : {}) },
          data: { ...updateData, currentStock: adjustType === 'IN' ? { increment: qty } : { decrement: qty } },
        });
        if (!changed.count) throw new Error('Insufficient stock for this adjustment');
        await tx.stockMovement.create({ data: { tenantId, itemId: id, type: adjustType, quantity: qty, notes: notes || `Stock adjustment (${adjustType})` } });
      } else if (updateData.currentStock !== undefined && updateData.currentStock !== existing.currentStock) {
        const delta = updateData.currentStock - existing.currentStock;
        const changed = await tx.inventoryItem.updateMany({ where: { id, tenantId, currentStock: existing.currentStock }, data: updateData });
        if (!changed.count) throw new Error('Stock changed concurrently; reload and try again');
        await tx.stockMovement.create({ data: { tenantId, itemId: id, type: delta > 0 ? 'IN' : 'OUT', quantity: Math.abs(delta), notes: notes || 'Stock corrected from item editor' } });
      } else {
        await tx.inventoryItem.update({ where: { id, tenantId }, data: updateData });
      }
      return tx.inventoryItem.findUniqueOrThrow({ where: { id }, include: { movements: { take: 10, orderBy: { createdAt: 'desc' } } } });
    }) as unknown as InventoryItem;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.$transaction(async tx => {
      const item = await tx.inventoryItem.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!item) throw new Error('Item not found');
      await tx.vendorItem.deleteMany({ where: { itemId: item.id } });
      await tx.stockMovement.deleteMany({ where: { itemId: item.id } });
      await tx.inventoryItem.delete({ where: { id: item.id, tenantId } });
    });
  }
}
