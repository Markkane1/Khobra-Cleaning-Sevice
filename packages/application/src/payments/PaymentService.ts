import { IPaymentRepository } from './IPaymentRepository';
import { CreatePaymentDTO, SelectPaymentMethodDTO, ReopenPaymentDTO } from '@repo/core';

export class PaymentService {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async getPayments(tenantId: string) {
    return this.paymentRepository.getPayments(tenantId);
  }

  async processPayment(tenantId: string, data: CreatePaymentDTO) {
    const payment = await this.paymentRepository.createPayment(tenantId, data);
    
    let invoiceUpdate: any = null;
    if (data.status === 'verified') {
      invoiceUpdate = await this.paymentRepository.updateInvoicePaymentStatus(data.invoiceId, data.amount);
    }
    
    return { payment, invoiceUpdate: invoiceUpdate || null };
  }

  async selectPaymentMethod(tenantId: string, userId: string, data: SelectPaymentMethodDTO) {
    return this.paymentRepository.selectPaymentMethod(tenantId, userId, data);
  }

  async reopenPayment(tenantId: string, adminUserId: string, data: ReopenPaymentDTO) {
    return this.paymentRepository.reopenPayment(tenantId, adminUserId, data.bookingId, data.reason);
  }

  async verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string) {
    return this.paymentRepository.verifyCashPayment(tenantId, adminUserId, paymentId, remarks);
  }
}

