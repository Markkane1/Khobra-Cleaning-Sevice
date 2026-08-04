import { IInvoiceRepository } from './IInvoiceRepository';
import { CreateInvoiceDTO, UpdateInvoiceDTO } from '@repo/core';
import { randomUUID } from 'crypto';

export class InvoiceService {
  constructor(private readonly invoiceRepository: IInvoiceRepository) {}

  async getInvoices(tenantId: string) {
    return this.invoiceRepository.getInvoices(tenantId);
  }

  async createInvoice(tenantId: string, data: CreateInvoiceDTO) {
    const invoiceNo = `INV-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.invoiceRepository.createInvoice(tenantId, invoiceNo, data);
  }

  async updateInvoice(data: UpdateInvoiceDTO) {
    const { id, ...updateData } = data;
    return this.invoiceRepository.updateInvoice(id, updateData);
  }
}
