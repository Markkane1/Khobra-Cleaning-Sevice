import { IPaymentRepository } from '@repo/application';
import { PrismaClient } from '@prisma/client';

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPayments(tenantId: string): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { invoice: { include: { customer: { include: { user: { select: { name: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayment(tenantId: string, data: any): Promise<any> {
    return this.prisma.payment.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async updateInvoicePaymentStatus(invoiceId: string, amount: number): Promise<{ invoiceNo: string; newStatus: string } | null> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;
    
    const newPaid = (invoice.paidAmount || 0) + amount;
    const newStatus = newPaid >= invoice.totalAmount ? 'paid' : 'partially_paid';
    
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus },
    });
    
    return { invoiceNo: invoice.invoiceNo, newStatus };
  }
}
