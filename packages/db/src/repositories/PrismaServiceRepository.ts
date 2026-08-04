import { PrismaClient } from '@prisma/client';
import { IServiceRepository, Service } from '@repo/application';
import { CreateServiceDTO, UpdateServiceDTO } from '@repo/core';

export class PrismaServiceRepository implements IServiceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Service[]> {
    return this.db.service.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    }) as unknown as Service[];
  }

  async findById(tenantId: string, id: string): Promise<Service | null> {
    return this.db.service.findFirst({
      where: { id, tenantId, deletedAt: null },
    }) as unknown as Service | null;
  }

  async create(tenantId: string, data: CreateServiceDTO): Promise<Service> {
    return this.db.service.create({
      data: {
        tenantId,
        ...data,
        minDuration: 2,
      },
    }) as unknown as Service;
  }

  async update(tenantId: string, id: string, data: UpdateServiceDTO): Promise<Service> {
    const { id: _id, ...updateData } = data;
    return this.db.service.update({
      where: { id, tenantId },
      data: { ...updateData, minDuration: 2 },
    }) as unknown as Service;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.service.update({
      where: { id, tenantId },
      data: { status: 'inactive', deletedAt: new Date() },
    });
  }
}
