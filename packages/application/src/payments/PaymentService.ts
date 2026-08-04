import { IPaymentRepository } from './IPaymentRepository';
import { CreatePaymentDTO, SelectPaymentMethodDTO, ReopenPaymentDTO } from '@repo/core';

export class PaymentService {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async getPayments(tenantId: string) {
    return this.paymentRepository.getPayments(tenantId);
  }

  async processPayment(tenantId: string, recordedBy: string, data: CreatePaymentDTO) {
    return this.paymentRepository.createPayment(tenantId, recordedBy, data);
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
