import { PrismaClient } from '@prisma/client';
import { IBranchRepository, Branch } from '@repo/application';
import { CreateBranchDTO, UpdateBranchDTO } from '@repo/core';

export class PrismaBranchRepository implements IBranchRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Branch[]> {
    return this.db.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }) as unknown as Branch[];
  }

  async findById(id: string): Promise<Branch | null> {
    return this.db.branch.findUnique({
      where: { id },
    }) as unknown as Branch | null;
  }

  async create(tenantId: string, data: CreateBranchDTO): Promise<Branch> {
    const branchData: any = {
      tenantId,
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
      status: data.status || 'active',
    };

    return this.db.branch.create({
      data: branchData,
    }) as unknown as Branch;
  }

  async update(id: string, data: UpdateBranchDTO): Promise<Branch> {
    const { id: _id, ...updateData } = data;
    
    return this.db.branch.update({
      where: { id },
      data: updateData as any,
    }) as unknown as Branch;
  }

  async delete(id: string): Promise<void> {
    await this.db.branch.delete({ where: { id } });
  }
}
