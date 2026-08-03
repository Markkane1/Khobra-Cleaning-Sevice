import { CreateVendorDTO, UpdateVendorDTO } from '@repo/core';

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
}

export interface IVendorRepository {
  findManyByTenant(tenantId: string): Promise<Vendor[]>;
  findById(id: string): Promise<Vendor | null>;
  create(tenantId: string, data: CreateVendorDTO): Promise<Vendor>;
  update(id: string, data: UpdateVendorDTO): Promise<Vendor>;
  delete(id: string): Promise<void>;
}
