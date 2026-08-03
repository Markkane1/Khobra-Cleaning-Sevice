import assert from 'node:assert/strict'
import test from 'node:test'
import { canCleanerReceiveCash, CleanerReceiveCashSchema } from './schema.ts'

test('allows only assigned cleaner to receive cash for completed booking with outstanding balance', () => {
  const completedBooking = {
    status: 'completed',
    totalAmount: 120,
    netAmount: 120,
    assignments: [{ employeeId: 'emp_cleaner1', employee: { userId: 'user_cleaner1' } }],
    invoices: [{ paidAmount: 0, payments: [] }],
  }

  // Assigned cleaner can receive cash
  const assignedResult = canCleanerReceiveCash(completedBooking, 'emp_cleaner1')
  assert.equal(assignedResult.canReceive, true)
  assert.equal(assignedResult.remainingPayable, 120)

  // Unassigned cleaner cannot receive cash
  const unassignedResult = canCleanerReceiveCash(completedBooking, 'emp_cleaner99')
  assert.equal(unassignedResult.canReceive, false)
  assert.equal(unassignedResult.reason, 'Cleaner is not assigned to this booking')
})

test('rejects cash receipt if booking is not completed', () => {
  const inProgressBooking = {
    status: 'in_progress',
    totalAmount: 120,
    netAmount: 120,
    assignments: [{ employeeId: 'emp_cleaner1' }],
    invoices: [{ paidAmount: 0, payments: [] }],
  }

  const result = canCleanerReceiveCash(inProgressBooking, 'emp_cleaner1')
  assert.equal(result.canReceive, false)
  assert.equal(result.reason, 'Booking is not completed')
})

test('prevents duplicate cash collection if payment status is already paid or verified', () => {
  const paidBooking = {
    status: 'completed',
    totalAmount: 120,
    netAmount: 120,
    assignments: [{ employeeId: 'emp_cleaner1' }],
    invoices: [{ paidAmount: 120, payments: [{ method: 'cash', status: 'verified' }] }],
  }

  const result = canCleanerReceiveCash(paidBooking, 'emp_cleaner1')
  assert.equal(result.canReceive, false)
  assert.equal(result.reason, 'Payment is already completed or verified')
})

test('validates CleanerReceiveCashSchema', () => {
  const invalid = CleanerReceiveCashSchema.safeParse({})
  assert.equal(invalid.success, false)

  const valid = CleanerReceiveCashSchema.safeParse({
    bookingId: 'bk_9876',
    remarks: 'Received 120 AED in cash',
  })
  assert.equal(valid.success, true)
})
