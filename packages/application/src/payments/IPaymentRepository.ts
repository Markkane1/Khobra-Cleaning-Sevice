export interface IPaymentRepository {
  getPayments(tenantId: string): Promise<any[]>;
  createPayment(tenantId: string, data: any): Promise<any>;
  updateInvoicePaymentStatus(invoiceId: string, amount: number): Promise<{ invoiceNo: string; newStatus: string } | null>;
}
