import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBookingFinancials, SelectPaymentMethodSchema, ReopenPaymentSchema } from './schema.ts'

test('allows payment method selection only when booking is completed and has outstanding balance', () => {
  const inProgressBooking = {
    status: 'in_progress',
    totalAmount: 100,
    netAmount: 100,
    invoices: [{ paidAmount: 0, payments: [] }],
  }

  const inProgressFinancials = calculateBookingFinancials(inProgressBooking)
  assert.equal(inProgressFinancials.canSelectPaymentMethod, false)

  const completedBooking = {
    status: 'completed',
    totalAmount: 100,
    netAmount: 100,
    invoices: [{ paidAmount: 0, payments: [] }],
  }

  const completedFinancials = calculateBookingFinancials(completedBooking)
  assert.equal(completedFinancials.canSelectPaymentMethod, true)
  assert.equal(completedFinancials.remainingPayableAmount, 100)
  assert.equal(completedFinancials.paymentStatus, 'payment_pending')
})

test('correctly calculates financial breakdown with adjustments and paid amounts', () => {
  const booking = {
    status: 'completed',
    totalAmount: 150,
    discount: 20,
    netAmount: 130,
    invoices: [{ paidAmount: 50, payments: [{ method: 'cash', status: 'cash_selected' }] }],
  }

  const financials = calculateBookingFinancials(booking)
  assert.equal(financials.bookingAmount, 150)
  assert.equal(financials.discount, 20)
  assert.equal(financials.netAmount, 130)
  assert.equal(financials.paidAmount, 50)
  assert.equal(financials.remainingPayableAmount, 80)
  assert.equal(financials.paymentStatus, 'cash_selected')
  assert.equal(financials.selectedPaymentMethod, 'cash')
})

test('locks payment method selection when payment status is paid', () => {
  const paidBooking = {
    status: 'completed',
    totalAmount: 100,
    netAmount: 100,
    invoices: [{ paidAmount: 100, payments: [{ method: 'bank_transfer', status: 'verified' }] }],
  }

  const financials = calculateBookingFinancials(paidBooking)
  assert.equal(financials.canSelectPaymentMethod, false)
  assert.equal(financials.paymentStatus, 'paid')
  assert.equal(financials.remainingPayableAmount, 0)
})

test('validates SelectPaymentMethodSchema for cash and bank transfer options', () => {
  // Cash selection (valid without bank fields)
  const validCash = SelectPaymentMethodSchema.safeParse({
    bookingId: 'bk_123',
    method: 'cash',
  })
  assert.equal(validCash.success, true)

  // Bank transfer selection (requires reference, bank name, account holder, proof)
  const invalidBank = SelectPaymentMethodSchema.safeParse({
    bookingId: 'bk_123',
    method: 'bank_transfer',
  })
  assert.equal(invalidBank.success, false)

  const validBank = SelectPaymentMethodSchema.safeParse({
    bookingId: 'bk_123',
    method: 'bank_transfer',
    referenceNo: 'TRX12345',
    customerBankName: 'Emirates NBD',
    accountHolderName: 'Fatima Ali',
    proofUrl: 'https://res.cloudinary.com/demo/tenant1/payment-proofs/proof.png',
  })
  assert.equal(validBank.success, true)
})

test('validates ReopenPaymentSchema for admin payment reopening', () => {
  const validReopen = ReopenPaymentSchema.safeParse({
    bookingId: 'bk_123',
    reason: 'Customer wants to change payment method from Cash to Bank Transfer',
  })
  assert.equal(validReopen.success, true)
})
