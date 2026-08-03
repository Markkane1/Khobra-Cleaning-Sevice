import { IInvoiceRepository } from './IInvoiceRepository';
import { CreateInvoiceDTO, UpdateInvoiceDTO } from '@repo/core';

export class InvoiceService {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async getInvoices(tenantId: string) {
    return this.invoiceRepository.getInvoices(tenantId);
  }

  async createInvoice(tenantId: string, data: CreateInvoiceDTO) {
    const count = await this.invoiceRepository.countInvoices(tenantId);
    const invoiceNo = `INV-${String(2000 + count).padStart(5, '0')}`;
    return this.invoiceRepository.createInvoice(tenantId, invoiceNo, data);
  }

  async updateInvoice(data: UpdateInvoiceDTO) {
    const { id, ...updateData } = data;
    return this.invoiceRepository.updateInvoice(id, updateData);
  }
}
