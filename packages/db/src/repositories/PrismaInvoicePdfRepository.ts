import { IInvoicePdfRepository } from '@repo/application';
import { PrismaClient } from '@prisma/client';

export class PrismaInvoicePdfRepository implements IInvoicePdfRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getInvoiceForPdf(tenantId: string, invoiceId: string): Promise<any> {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
        booking: { include: { service: { select: { name: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
