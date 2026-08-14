import assert from 'node:assert/strict'
import test from 'node:test'
import { InvoiceService } from './InvoiceService.ts'

test('booking invoice amounts override a caller-supplied total', async () => {
  let received
  const service = new InvoiceService({ createInvoice: async (_tenantId, _invoiceNo, data) => { received = data; return data } })
  await service.createInvoice('tenant-1', { customerId: 'customer-1', bookingId: 'booking-1', totalAmount: 1, status: 'issued' }, { subtotal: 200, taxAmount: 10, discount: 5, totalAmount: 205 })
  assert.deepEqual(received, { customerId: 'customer-1', bookingId: 'booking-1', totalAmount: 205, status: 'issued', subtotal: 200, taxAmount: 10, discount: 5 })
})
