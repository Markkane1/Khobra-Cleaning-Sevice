import { IPaymentRepository } from './IPaymentRepository';
import { CreatePaymentDTO } from '@repo/core';

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
}
