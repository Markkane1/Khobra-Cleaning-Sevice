export interface IPaymentRepository {
  getPayments(tenantId: string): Promise<any[]>;
  createPayment(tenantId: string, recordedBy: string, data: any): Promise<any>;
  selectPaymentMethod(tenantId: string, userId: string, data: any): Promise<any>;
  reopenPayment(tenantId: string, adminUserId: string, bookingId: string, reason?: string): Promise<any>;
  verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string): Promise<any>;
  cleanerReceiveCash(tenantId: string, cleanerUserId: string, bookingId: string, remarks?: string): Promise<any>;
  getCompanyBankAccounts(tenantId: string, adminMode?: boolean): Promise<any[]>;
  saveCompanyBankAccount(tenantId: string, userId: string, data: any): Promise<any>;
  toggleCompanyBankAccountActive(tenantId: string, userId: string, accountId: string, isActive: boolean): Promise<any>;
  deleteCompanyBankAccount(tenantId: string, userId: string, accountId: string): Promise<{ success: boolean; softDeleted: boolean; message: string }>;
}
