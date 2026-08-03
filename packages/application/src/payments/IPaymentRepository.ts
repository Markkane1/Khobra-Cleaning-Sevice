export interface IPaymentRepository {
  getPayments(tenantId: string): Promise<any[]>;
  createPayment(tenantId: string, data: any): Promise<any>;
  updateInvoicePaymentStatus(invoiceId: string, amount: number): Promise<{ invoiceNo: string; newStatus: string } | null>;
  selectPaymentMethod(tenantId: string, userId: string, data: any): Promise<any>;
  reopenPayment(tenantId: string, adminUserId: string, bookingId: string, reason?: string): Promise<any>;
  verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string): Promise<any>;
}

