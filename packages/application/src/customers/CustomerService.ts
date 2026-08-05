import { CreateCustomerDTO, UpdateCustomerDTO } from '@repo/core';
import { ICustomerRepository, Customer } from './ICustomerRepository';

export class CustomerService {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async getCustomers(tenantId: string): Promise<Customer[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.customerRepository.findManyByTenant(tenantId);
  }

  async createCustomer(tenantId: string, data: CreateCustomerDTO): Promise<Customer> {
    if (!tenantId) throw new Error('Tenant ID is required');
    // Here you can add domain validation or business logic
    return this.customerRepository.create(tenantId, data);
  }

  async updateCustomer(tenantId: string, data: UpdateCustomerDTO): Promise<Customer> {
    const existing = await this.customerRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Customer not found');
    return this.customerRepository.update(tenantId, data.id, data);
  }

  async deleteCustomer(tenantId: string, id: string): Promise<void> {
    const existing = await this.customerRepository.findById(tenantId, id);
    if (!existing) throw new Error('Customer not found');
    return this.customerRepository.delete(tenantId, id);
  }
}
