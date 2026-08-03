import { IInvoicePdfRepository } from './IInvoicePdfRepository';

export class InvoicePdfService {
  constructor(private readonly invoicePdfRepository: IInvoicePdfRepository) {}

  async getInvoiceForPdf(tenantId: string, invoiceId: string) {
    return this.invoicePdfRepository.getInvoiceForPdf(tenantId, invoiceId);
  }
}
