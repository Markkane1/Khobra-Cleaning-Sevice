import { IPaymentRepository } from '@repo/application';
import { PrismaClient } from '@prisma/client';

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPayments(tenantId: string): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { invoice: { include: { customer: { include: { user: { select: { id: true, name: true } } } }, booking: { select: { bookingNo: true } } } } },
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

  async selectPaymentMethod(tenantId: string, userId: string, data: any): Promise<any> {
    const { bookingId, method, customerBankName, accountHolderName, referenceNo, transferDate, proofUrl, notes } = data;

    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } }, customer: true },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Payment selection is available only after the booking is Completed');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        const invCount = await tx.invoice.count({ where: { tenantId } });
        const invoiceNo = `INV-${String(1000 + invCount).padStart(5, '0')}`;
        invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNo,
            bookingId: booking.id,
            customerId: booking.customerId,
            status: 'issued',
            issuedAt: new Date(),
            subtotal: booking.netAmount,
            totalAmount: booking.netAmount,
            paidAmount: 0,
            discount: booking.discount || 0,
          },
          include: { payments: { orderBy: { createdAt: 'desc' } } },
        });
      }

      const remainingPayable = Math.max(0, Math.round((invoice.totalAmount - invoice.paidAmount) * 100) / 100);
      if (remainingPayable <= 0) {
        throw new Error('This booking has no outstanding payable amount');
      }

      const existingVerifiedPayment = invoice.payments.find(p => p.status === 'verified' || p.status === 'paid');
      if (existingVerifiedPayment) {
        throw new Error('Payment for this booking has already been verified and locked. An Admin must reopen the payment before changing the payment method.');
      }

      const status = method === 'cash' ? 'cash_selected' : 'under_verification';

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: remainingPayable,
          method,
          status,
          selectedBy: userId,
          customerBankName: method === 'bank_transfer' ? customerBankName : null,
          accountHolderName: method === 'bank_transfer' ? accountHolderName : null,
          referenceNo: method === 'bank_transfer' ? referenceNo : (method === 'cash' ? `CASH-${Date.now()}` : null),
          transferDate: method === 'bank_transfer' && transferDate ? new Date(transferDate) : null,
          proofUrl: method === 'bank_transfer' ? proofUrl : null,
          submittedAt: new Date(),
          notes,
        },
        include: { invoice: { include: { booking: { select: { bookingNo: true } } } } },
      });

      return payment;
    });
  }

  async reopenPayment(tenantId: string, adminUserId: string, bookingId: string, reason?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: true } } },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const invoice = booking.invoices[0];
      if (!invoice) {
        throw new Error('No invoice found for this booking');
      }

      await tx.payment.updateMany({
        where: { invoiceId: invoice.id, tenantId },
        data: {
          status: 'rejected',
          decisionRemarks: reason || `Payment reopened by Admin (${adminUserId})`,
          rejectedAt: new Date(),
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'issued',
          paidAmount: 0,
        },
      });

      return { success: true, bookingId, invoiceId: invoice.id, reopenedBy: adminUserId };
    });
  }

  async verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId, method: 'cash' },
        include: { invoice: true },
      });

      if (!payment) {
        throw new Error('Cash payment record not found');
      }

      if (payment.status === 'verified' || payment.status === 'paid') {
        throw new Error('Payment is already verified');
      }

      const now = new Date();
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'verified',
          verifiedBy: adminUserId,
          verifiedAt: now,
          decisionRemarks: remarks || 'Cash payment verified by Admin',
        },
      });

      const newPaidAmount = (payment.invoice.paidAmount || 0) + payment.amount;
      const newInvoiceStatus = newPaidAmount + 0.001 >= payment.invoice.totalAmount ? 'paid' : 'partially_paid';

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newInvoiceStatus,
        },
      });

      return updatedPayment;
    });
  }
}

