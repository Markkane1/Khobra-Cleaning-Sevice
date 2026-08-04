import { PrismaClient } from '@prisma/client';
import { ICustomerRepository, Customer } from '@repo/application';
import { CreateCustomerDTO, UpdateCustomerDTO } from '@repo/core';
import { hashPassword } from '../password';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Customer[]> {
    return this.db.customer.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, email: true } }, _count: { select: { bookings: true } } },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Customer[];
  }

  async findById(id: string): Promise<Customer | null> {
    return this.db.customer.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    }) as unknown as Customer | null;
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
          ...custData,
        },
        include: { user: { select: { name: true, email: true } } },
      });
    }) as unknown as Customer;
  }


  async update(id: string, data: UpdateCustomerDTO): Promise<Customer> {
    const customer = await this.db.customer.findUnique({ where: { id } });
    if (customer) {
      await this.db.user.update({
        where: { id: customer.userId },
        data: { name: data.name, email: data.email, phone: data.phone },
      });
    }

    const { id: _id, email, name, phone, ...custData } = data;

    return this.db.customer.update({
      where: { id },
      data: custData,
      include: { user: { select: { name: true, email: true } } }
    }) as unknown as Customer;
  }

  async delete(id: string): Promise<void> {
    const customer = await this.db.customer.findUnique({ where: { id }, select: { userId: true } });
    if (!customer) return;

    const now = new Date()

    // ponytail: Soft delete customer and user to preserve historical invoices & bookings
    await this.db.$transaction([
      this.db.customer.update({
        where: { id },
        data: { status: 'inactive', deletedAt: now },
      }),
      this.db.user.update({
        where: { id: customer.userId },
        data: { status: 'inactive' },
      }),
    ])
  }

}
