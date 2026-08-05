import { CreateDriverDTO, UpdateDriverDTO } from '@repo/core/src/drivers/schema';

export interface Driver {
  id: string;
  tenantId: string;
  userId: string;
  licenseNo: string | null;
  vehicleNo: string | null;
  status: string | null;
  user: {
    name: string | null;
    email: string;
    phone: string | null;
  };
}

export interface IDriverRepository {
  findManyByTenant(tenantId: string): Promise<Driver[]>;
  findById(tenantId: string, id: string): Promise<Driver | null>;
  create(tenantId: string, data: CreateDriverDTO): Promise<Driver>;
  update(tenantId: string, id: string, data: UpdateDriverDTO): Promise<Driver>;
  delete(tenantId: string, id: string): Promise<void>;
}
