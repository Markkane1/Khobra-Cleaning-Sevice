export interface IInvoiceRepository {
  getInvoices(tenantId: string): Promise<any[]>;
  createInvoice(tenantId: string, invoiceNo: string, data: any): Promise<any>;
  updateInvoice(id: string, data: any): Promise<any>;
  countInvoices(tenantId: string): Promise<number>;
  getInvoiceById(id: string): Promise<any>;
}
