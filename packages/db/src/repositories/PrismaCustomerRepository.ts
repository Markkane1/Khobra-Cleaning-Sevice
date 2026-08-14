import type { PrismaClient } from '@prisma/client';
import type { ICustomerRepository, Customer } from '@repo/application';
import type { CreateCustomerDTO, UpdateCustomerDTO } from '@repo/core';
import { hashPassword } from '../password.ts';

export class PrismaCustomerRepository implements ICustomerRepository {
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async findManyByTenant(tenantId: string): Promise<Customer[]> {
    const customers = await this.db.customer.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, email: true, phone: true } }, _count: { select: { bookings: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return customers.map(customer => ({ ...customer, phone: customer.phone || customer.user.phone })) as unknown as Customer[];
  }

  async findById(tenantId: string, id: string): Promise<Customer | null> {
    const customer = await this.db.customer.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    return customer ? { ...customer, phone: customer.phone || customer.user.phone } as unknown as Customer : null;
  }

  async create(tenantId: string, data: CreateCustomerDTO): Promise<Customer> {
    const { email, name, phone, temporaryPassword, ...custData } = data;
    
    return this.db.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          name,
          phone,
          passwordHash: hashPassword(temporaryPassword),
          role: 'customer',
          status: 'active',
        },
      });

      return tx.customer.create({
        data: {
          tenantId,
          userId: user.id,
          phone,
          ...custData,
        },
        include: { user: { select: { name: true, email: true, phone: true } } },
      });
    }) as unknown as Customer;
  }


  async update(tenantId: string, id: string, data: UpdateCustomerDTO): Promise<Customer> {
    const { id: _id, email, name, phone, ...custData } = data;
    return this.db.$transaction(async tx => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId } });
      if (!customer) throw new Error('Customer not found');
      await tx.user.update({
        where: { id: customer.userId },
        data: { name, email, phone },
      });
      return tx.customer.update({ where: { id, tenantId }, data: { ...custData, phone }, include: { user: { select: { name: true, email: true, phone: true } } } });
    }) as unknown as Customer;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const customer = await this.db.customer.findFirst({ where: { id, tenantId }, select: { userId: true, user: { select: { role: true } } } });
    if (!customer) return;
    if (customer.user.role === 'admin') throw Object.assign(new Error('Remove the administrator role before deleting this customer profile'), { status: 409 });

    const now = new Date()

    // ponytail: Soft delete customer and user to preserve historical invoices & bookings
    await this.db.$transaction([
      this.db.customer.update({
        where: { id, tenantId },
        data: { status: 'inactive', deletedAt: now },
      }),
      this.db.user.update({
        where: { id: customer.userId },
        data: { status: 'inactive' },
      }),
    ])
  }

}
