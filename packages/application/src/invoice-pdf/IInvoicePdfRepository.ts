export interface IInvoicePdfRepository {
  getInvoiceForPdf(tenantId: string, invoiceId: string): Promise<any>;
}
