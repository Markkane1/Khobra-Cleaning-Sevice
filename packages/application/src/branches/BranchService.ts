import { CreateBranchDTO, UpdateBranchDTO } from '@repo/core';
import { IBranchRepository, Branch } from './IBranchRepository';

export class BranchService {
  constructor(private readonly branchRepository: IBranchRepository) {}

  async getBranches(tenantId: string): Promise<Branch[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.branchRepository.findManyByTenant(tenantId);
  }

  async createBranch(tenantId: string, data: CreateBranchDTO): Promise<Branch> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.branchRepository.create(tenantId, data);
  }

  async updateBranch(tenantId: string, data: UpdateBranchDTO): Promise<Branch> {
    const existing = await this.branchRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Branch not found');
    return this.branchRepository.update(tenantId, data.id, data);
  }

  async deleteBranch(tenantId: string, id: string): Promise<void> {
    const existing = await this.branchRepository.findById(tenantId, id);
    if (!existing) throw new Error('Branch not found');
    return this.branchRepository.delete(tenantId, id);
  }
}
