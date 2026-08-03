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

  async cleanerReceiveCash(tenantId: string, cleanerUserId: string, bookingId: string, remarks?: string) {
    return this.paymentRepository.cleanerReceiveCash(tenantId, cleanerUserId, bookingId, remarks);
  }

  async getCompanyBankAccount(tenantId: string) {
    return this.paymentRepository.getCompanyBankAccount(tenantId);
  }

  async submitBankTransfer(tenantId: string, userId: string, data: any) {
    return this.paymentRepository.submitBankTransfer(tenantId, userId, data);
  }

  async decideBankTransfer(tenantId: string, adminUserId: string, paymentId: string, decision: 'approve' | 'reject', remarks?: string) {
    return this.paymentRepository.decideBankTransfer(tenantId, adminUserId, paymentId, decision, remarks);
  }

  async getCompanyBankAccounts(tenantId: string, adminMode?: boolean) {
    return this.paymentRepository.getCompanyBankAccounts(tenantId, adminMode);
  }

  async saveCompanyBankAccount(tenantId: string, userId: string, data: any) {
    return this.paymentRepository.saveCompanyBankAccount(tenantId, userId, data);
  }

  async toggleCompanyBankAccountActive(tenantId: string, userId: string, accountId: string, isActive: boolean) {
    return this.paymentRepository.toggleCompanyBankAccountActive(tenantId, userId, accountId, isActive);
  }

  async deleteCompanyBankAccount(tenantId: string, userId: string, accountId: string) {
    return this.paymentRepository.deleteCompanyBankAccount(tenantId, userId, accountId);
  }
}

