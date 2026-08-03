import { CreateServiceDTO, UpdateServiceDTO } from '@repo/core';

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  baseRate: number;
  minDuration: number;
  category?: string | null;
  status: string;
  requiresMaterials: boolean;
  skills?: string | null;
  galleryImages?: string[] | null;
  heroImages?: string[] | null;
}

export interface IServiceRepository {
  findManyByTenant(tenantId: string): Promise<Service[]>;
  findById(id: string): Promise<Service | null>;
  create(tenantId: string, data: CreateServiceDTO): Promise<Service>;
  update(id: string, data: UpdateServiceDTO): Promise<Service>;
  delete(id: string): Promise<void>;
}
