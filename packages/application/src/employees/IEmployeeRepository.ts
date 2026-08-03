import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@repo/core';

export interface Employee {
  id: string;
  tenantId: string;
  userId: string;
  employeeCode: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  skills?: string | null;
  baseSalary: number;
  status: string;
  averageRating: number;
  ratingCount: number;
  user: {
    name: string | null;
    email: string;
    phone?: string | null;
  };
}

export interface IEmployeeRepository {
  findManyByTenant(tenantId: string): Promise<Employee[]>;
  findById(id: string): Promise<Employee | null>;
  create(tenantId: string, data: CreateEmployeeDTO): Promise<Employee>;
  update(id: string, data: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
}
