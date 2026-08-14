import { CreateCustomerDTO, UpdateCustomerDTO } from '@repo/core';

export interface Customer {
  id: string;
  tenantId: string;
  userId: string;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  addresses?: Array<{ label?: string; address: string; city?: string; area?: string }> | null;
  area?: string | null;
  notes?: string | null;
  preferences?: string | null;
  status: string;
  user: {
    name: string | null;
    email: string;
  };
}

export interface ICustomerRepository {
  findManyByTenant(tenantId: string): Promise<Customer[]>;
  findById(tenantId: string, id: string): Promise<Customer | null>;
  create(tenantId: string, data: CreateCustomerDTO): Promise<Customer>;
  update(tenantId: string, id: string, data: UpdateCustomerDTO): Promise<Customer>;
  delete(tenantId: string, id: string): Promise<void>;
}
