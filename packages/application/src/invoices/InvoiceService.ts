import type { IInvoiceRepository } from './IInvoiceRepository';
import type { CreateInvoiceDTO, UpdateInvoiceDTO } from '@repo/core';
import { randomUUID } from 'crypto';

type InvoiceAmounts = { subtotal: number; taxAmount: number; totalAmount: number; discount: number };

export class InvoiceService {
  private readonly invoiceRepository: IInvoiceRepository;

  constructor(invoiceRepository: IInvoiceRepository) {
    this.invoiceRepository = invoiceRepository;
  }

  async getInvoices(tenantId: string) {
    return this.invoiceRepository.getInvoices(tenantId);
  }

  async createInvoice(tenantId: string, data: CreateInvoiceDTO, amounts?: InvoiceAmounts) {
    const invoiceNo = `INV-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.invoiceRepository.createInvoice(tenantId, invoiceNo, { ...data, ...amounts });
  }

  async updateInvoice(tenantId: string, data: UpdateInvoiceDTO) {
    const { id, ...updateData } = data;
    return this.invoiceRepository.updateInvoice(tenantId, id, updateData);
  }
}
