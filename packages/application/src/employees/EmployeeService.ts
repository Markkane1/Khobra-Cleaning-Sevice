import { CreateEmployeeDTO, UpdateEmployeeDTO } from '@repo/core';
import { IEmployeeRepository, Employee } from './IEmployeeRepository';

export class EmployeeService {
  constructor(private readonly employeeRepository: IEmployeeRepository) {}

  async getEmployees(tenantId: string): Promise<Employee[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.employeeRepository.findManyByTenant(tenantId);
  }

  async createEmployee(tenantId: string, data: CreateEmployeeDTO): Promise<Employee> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.employeeRepository.create(tenantId, data);
  }

  async updateEmployee(tenantId: string, data: UpdateEmployeeDTO): Promise<Employee> {
    const existing = await this.employeeRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Employee not found');
    return this.employeeRepository.update(tenantId, data.id, data);
  }

  async deleteEmployee(tenantId: string, id: string): Promise<void> {
    const existing = await this.employeeRepository.findById(tenantId, id);
    if (!existing) throw new Error('Employee not found');
    return this.employeeRepository.delete(tenantId, id);
  }
}
