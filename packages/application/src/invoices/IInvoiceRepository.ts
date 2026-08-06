export interface IInvoiceRepository {
  getInvoices(tenantId: string): Promise<any[]>;
  createInvoice(tenantId: string, invoiceNo: string, data: any): Promise<any>;
  updateInvoice(tenantId: string, id: string, data: any): Promise<any>;
  getInvoiceById(tenantId: string, id: string): Promise<any>;
}
