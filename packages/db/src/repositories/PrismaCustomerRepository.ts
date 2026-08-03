import { PrismaClient } from '@prisma/client';
import { ICustomerRepository, Customer } from '@repo/application';
import { CreateCustomerDTO, UpdateCustomerDTO } from '@repo/core';

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
    const user = await this.db.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: 'customer',
        status: 'active',
      },
    });

    const { email, name, phone, ...custData } = data;
    
    return this.db.customer.create({
      data: {
        tenantId,
        userId: user.id,
        ...custData,
      },
      include: { user: { select: { name: true, email: true } } }
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

    // Delete child records first (no onDelete: Cascade in schema)
    await this.db.complaint.deleteMany({ where: { customerId: id } });
    // Nullify bookingId on invoices before deleting bookings
    const bookings = await this.db.booking.findMany({ where: { customerId: id }, select: { id: true } });
    const bookingIds = bookings.map(b => b.id);
    if (bookingIds.length > 0) {
      await this.db.invoice.updateMany({ where: { bookingId: { in: bookingIds } }, data: { bookingId: null } });
      await this.db.assignment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await this.db.booking.deleteMany({ where: { customerId: id } });
    }
    await this.db.invoice.deleteMany({ where: { customerId: id } });
    await this.db.customer.delete({ where: { id } });
    await this.db.user.delete({ where: { id: customer.userId } });
  }
}
