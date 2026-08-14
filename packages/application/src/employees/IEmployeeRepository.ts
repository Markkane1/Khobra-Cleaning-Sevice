import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@repo/core';

export interface Employee {
  id: string;
  tenantId: string;
  userId: string;
  employeeCode: string;
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
  findById(tenantId: string, id: string): Promise<Employee | null>;
  create(tenantId: string, data: CreateEmployeeDTO): Promise<Employee>;
  update(tenantId: string, id: string, data: UpdateEmployeeDTO): Promise<Employee>;
  delete(tenantId: string, id: string): Promise<void>;
}
