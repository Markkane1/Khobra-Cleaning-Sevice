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

  async findById(id: string): Promise<Vendor | null> {
    return this.db.vendor.findUnique({
      where: { id },
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

  async update(id: string, data: UpdateVendorDTO): Promise<Vendor> {
    const { id: _id, ...updateData } = data;
    return this.db.vendor.update({
      where: { id },
      data: {
        ...updateData,
        email: updateData.email || null,
      },
    }) as unknown as Vendor;
  }

  async delete(id: string): Promise<void> {
    // Delete VendorItems first (no onDelete: Cascade in schema)
    await this.db.vendorItem.deleteMany({ where: { vendorId: id } });
    await this.db.vendor.delete({ where: { id } });
  }
}
