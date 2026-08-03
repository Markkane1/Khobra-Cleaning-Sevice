import { CreateBranchDTO, UpdateBranchDTO } from '@repo/core';

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranchRepository {
  findManyByTenant(tenantId: string): Promise<Branch[]>;
  findById(id: string): Promise<Branch | null>;
  create(tenantId: string, data: CreateBranchDTO): Promise<Branch>;
  update(id: string, data: UpdateBranchDTO): Promise<Branch>;
  delete(id: string): Promise<void>;
}
