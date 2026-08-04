import { IInvoiceRepository } from '@repo/application';
import { PrismaClient } from '@prisma/client';

export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getInvoices(tenantId: string): Promise<any[]> {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: { customer: { include: { user: { select: { name: true } } } }, booking: { select: { id: true, bookingNo: true, status: true } }, payments: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(tenantId: string, invoiceNo: string, data: any): Promise<any> {
    return this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNo,
        subtotal: data.totalAmount,
        issuedAt: data.status === 'issued' ? new Date() : null,
        ...data,
      },
    });
  }

  async updateInvoice(id: string, data: any): Promise<any> {
    return this.prisma.invoice.update({
      where: { id },
      data,
    });
  }

  async getInvoiceById(id: string): Promise<any> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
        booking: { include: { service: { select: { name: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
