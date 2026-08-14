import { PrismaClient } from '@prisma/client';
import { IVendorRepository, Vendor } from '@repo/application';
import { CreateVendorDTO, UpdateVendorDTO } from '@repo/core';

export class PrismaVendorRepository implements IVendorRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Vendor[]> {
    return this.db.vendor.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }) as unknown as Vendor[];
  }

  async findById(tenantId: string, id: string): Promise<Vendor | null> {
    return this.db.vendor.findFirst({
      where: { id, tenantId },
    }) as unknown as Vendor | null;
  }

  async create(tenantId: string, data: CreateVendorDTO): Promise<Vendor> {
    return this.db.vendor.create({
      data: {
        tenantId,
        name: data.name,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email || null,
        address: data.address,
        status: data.status,
      },
    }) as unknown as Vendor;
  }

  async update(tenantId: string, id: string, data: UpdateVendorDTO): Promise<Vendor> {
    const { id: _id, ...updateData } = data;
    return this.db.vendor.update({
      where: { id, tenantId },
      data: {
        ...updateData,
        email: updateData.email || null,
      },
    }) as unknown as Vendor;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.$transaction(async tx => {
      const vendor = await tx.vendor.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!vendor) throw new Error('Vendor not found');
      await tx.vendorItem.deleteMany({ where: { vendorId: vendor.id } });
      await tx.vendor.delete({ where: { id: vendor.id, tenantId } });
    });
  }
}
