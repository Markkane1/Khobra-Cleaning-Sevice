import assert from 'node:assert/strict'
import test from 'node:test'
import { CreatePaymentSchema } from './schema.ts'
import { CreateInvoiceSchema, UpdateInvoiceSchema } from '../invoices/schema.ts'

test('transaction and invoice trust boundaries reject client-controlled paid states', () => {
  assert.equal(CreatePaymentSchema.safeParse({ invoiceId: 'inv-1', amount: 10, method: 'cash', referenceNo: 'RCPT-1' }).success, true)
  assert.equal(CreatePaymentSchema.safeParse({ invoiceId: 'inv-1', amount: 0, method: 'cash', referenceNo: 'RCPT-1' }).success, false)
  assert.equal(CreatePaymentSchema.safeParse({ invoiceId: 'inv-1', amount: 10, method: 'cash', referenceNo: 'RCPT-1', status: 'verified' }).success, false)
  assert.equal(CreateInvoiceSchema.safeParse({ customerId: 'customer-1', totalAmount: 100, status: 'paid' }).success, false)
  assert.equal(UpdateInvoiceSchema.safeParse({ id: 'inv-1', status: 'paid' }).success, false)
  assert.equal(UpdateInvoiceSchema.safeParse({ id: 'inv-1', paidAmount: 100 }).success, false)
})
