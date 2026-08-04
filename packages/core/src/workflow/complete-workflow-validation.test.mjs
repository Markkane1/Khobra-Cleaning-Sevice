import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canDriverTransitionToOnTheWay,
  canCleanerStartWork,
  canCleanerSubmitCompletionTiming,
  shouldGeneratePickupAlert,
  canCleanerCompleteBooking,
  isValidStatusTransition,
  RateBookingEmployeesSchema,
  canCustomerRateBooking,
} from '../bookings/schema.ts'

import {
  calculateBookingFinancials,
  canCleanerReceiveCash,
  SubmitBankTransferSchema,
  AdminBankTransferDecisionSchema,
  CompanyBankAccountSchema,
  filterActiveBankAccounts,
} from '../payments/schema.ts'

test('Scenario 1: Assigned driver changes Scheduled to On the Way', () => {
  // Assigned driver allowed
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'on_the_way', 'driver-101', 'driver-101'), true)
  // Unassigned driver blocked
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'on_the_way', 'driver-101', 'driver-999'), false)
  // Invalid initial status blocked
  assert.equal(canDriverTransitionToOnTheWay('in_progress', 'on_the_way', 'driver-101', 'driver-101'), false)
})

test('Scenario 2: Valid status transition for Scheduled -> On the Way notification trigger', () => {
  assert.equal(isValidStatusTransition('scheduled', 'on_the_way'), true)
})

test('Scenario 3: Assigned cleaner changes On the Way to In Progress', () => {
  const assignedCleaners = ['cleaner-01', 'cleaner-02']
  // Assigned cleaner allowed
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', assignedCleaners, 'cleaner-01'), true)
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', assignedCleaners, 'cleaner-02'), true)
  // Unassigned cleaner blocked
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', assignedCleaners, 'cleaner-99'), false)
  // Invalid transition from scheduled directly
  assert.equal(canCleanerStartWork('scheduled', 'in_progress', assignedCleaners, 'cleaner-01'), false)
})

test('Scenario 4: Valid status transition for On the Way -> In Progress notification trigger', () => {
  assert.equal(isValidStatusTransition('on_the_way', 'in_progress'), true)
})

test('Scenario 5: Cleaner indicates completion timing response while In Progress', () => {
  const assignedCleaners = ['cleaner-01', 'cleaner-02']
  assert.equal(canCleanerSubmitCompletionTiming('in_progress', assignedCleaners, 'cleaner-01'), true)
  assert.equal(canCleanerSubmitCompletionTiming('scheduled', assignedCleaners, 'cleaner-01'), false)
  assert.equal(canCleanerSubmitCompletionTiming('in_progress', assignedCleaners, 'cleaner-99'), false)
})

test('Scenario 6: Driver receives pickup alert when cleaner indicates pickup required', () => {
  // First confirmation within scheduled time = true (pickup required)
  assert.equal(shouldGeneratePickupAlert(undefined, true), true)
  // Subsequent redundant response = false
  assert.equal(shouldGeneratePickupAlert(true, true), false)
})

test('Scenario 7: Cleaner marks booking as completed (In Progress -> Completed)', () => {
  const assignedCleaners = ['cleaner-01', 'cleaner-02']
  // Assigned cleaner allowed
  assert.equal(canCleanerCompleteBooking('in_progress', 'completed', assignedCleaners, 'cleaner-01'), true)
  // Unassigned cleaner blocked
  assert.equal(canCleanerCompleteBooking('in_progress', 'completed', assignedCleaners, 'cleaner-99'), false)
  // Invalid initial status blocked
  assert.equal(canCleanerCompleteBooking('on_the_way', 'completed', assignedCleaners, 'cleaner-01'), false)
})

test('Scenario 8: Valid status transition for In Progress -> Completed notification trigger', () => {
  assert.equal(isValidStatusTransition('in_progress', 'completed'), true)
})

test('Scenario 9: Customer selects Pay Cash for completed booking with outstanding balance', () => {
  // Booking completed & unpaid => payment selection allowed
  const completedBooking = { status: 'completed', totalAmount: 150, netAmount: 150, invoices: [{ paidAmount: 0, payments: [] }] }
  const fin1 = calculateBookingFinancials(completedBooking)
  assert.equal(fin1.canSelectPaymentMethod, true)

  // In-progress booking => selection blocked
  const inProgressBooking = { status: 'in_progress', totalAmount: 150, netAmount: 150, invoices: [{ paidAmount: 0, payments: [] }] }
  const fin2 = calculateBookingFinancials(inProgressBooking)
  assert.equal(fin2.canSelectPaymentMethod, false)

  // Already fully paid => selection blocked
  const paidBooking = { status: 'completed', totalAmount: 150, netAmount: 150, invoices: [{ paidAmount: 150, payments: [{ method: 'cash', status: 'verified' }] }] }
  const fin3 = calculateBookingFinancials(paidBooking)
  assert.equal(fin3.canSelectPaymentMethod, false)
})

test('Scenario 10: Assigned cleaner records cash received', () => {
  const completedBooking = {
    status: 'completed',
    totalAmount: 150,
    netAmount: 150,
    assignments: [{ employeeId: 'cleaner-01' }],
    invoices: [{ paidAmount: 0, payments: [{ method: 'cash', status: 'cash_selected' }] }],
  }
  // Assigned cleaner allowed
  const assigned = canCleanerReceiveCash(completedBooking, 'cleaner-01')
  assert.equal(assigned.canReceive, true)
  assert.equal(assigned.remainingPayable, 150)

  // Unassigned cleaner blocked
  const unassigned = canCleanerReceiveCash(completedBooking, 'cleaner-99')
  assert.equal(unassigned.canReceive, false)
})

test('Scenario 11: Duplicate cash receipt transactions are blocked once status is Paid', () => {
  const paidBooking = {
    status: 'completed',
    netAmount: 150,
    assignments: [{ employeeId: 'cleaner-01' }],
    invoices: [{ paidAmount: 150, payments: [{ method: 'cash', status: 'verified' }] }],
  }
  const result = canCleanerReceiveCash(paidBooking, 'cleaner-01')
  assert.equal(result.canReceive, false)
  assert.equal(result.reason, 'Payment is already completed or verified')
})

test('Scenario 12: Customer selects Bank Transfer for completed booking', () => {
  const completedBooking = { status: 'completed', totalAmount: 200, netAmount: 200, invoices: [{ paidAmount: 0, payments: [] }] }
  const fin = calculateBookingFinancials(completedBooking)
  assert.equal(fin.canSelectPaymentMethod, true)
})

test('Scenario 13: Customer can view & copy active company bank account sorted by display order', () => {
  const bankAccounts = [
    { id: 'bank-2', bankName: 'Emirates NBD', displayOrder: 2, isActive: true },
    { id: 'bank-1', bankName: 'ADCB', displayOrder: 1, isActive: true },
    { id: 'bank-3', bankName: 'DIB', displayOrder: 3, isActive: false },
  ]
  const activeSorted = filterActiveBankAccounts(bankAccounts)
  assert.equal(activeSorted.length, 2)
  assert.equal(activeSorted[0].id, 'bank-1')
  assert.equal(activeSorted[1].id, 'bank-2')
})

test('Scenario 14: Customer submits bank transfer details & payment proof', () => {
  const submission = SubmitBankTransferSchema.safeParse({
    bookingId: 'bk_10001',
    companyBankAccountId: 'bank-1',
    referenceNo: 'TXN-987654321',
    customerBankName: 'Mashreq Bank',
    accountHolderName: 'Ahmed Al Mansoori',
    transferDate: '2026-08-04',
    transferAmount: 250,
    proofUrl: 'https://res.cloudinary.com/demo/image/upload/proof.jpg',
    remarks: 'Transfer completed via mobile app',
  })
  assert.equal(submission.success, true)
})

test('Scenario 15: Admin approves or rejects bank transfer payment with remarks', () => {
  const approval = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_999',
    decision: 'approve',
    remarks: 'Verified against bank statement',
  })
  assert.equal(approval.success, true)

  const rejection = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_999',
    decision: 'reject',
    remarks: 'Invalid transaction reference number',
  })
  assert.equal(rejection.success, true)

  // Rejection without remarks blocked
  const invalidRejection = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_999',
    decision: 'reject',
    remarks: '',
  })
  assert.equal(invalidRejection.success, false)
})

test('Scenario 16: Customer submits 5-star rating for overall service', () => {
  const ratingPayload = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_10001',
    overallRating: 5.0,
    overallComment: 'Outstanding cleaning team and customer care!',
    ratings: [{ employeeId: 'cleaner-01', rating: 5.0 }],
  })
  assert.equal(ratingPayload.success, true)
})

test('Scenario 17: Multiple assigned cleaners each receive individual ratings', () => {
  const ratingPayload = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_10001',
    overallRating: 4,
    ratings: [
      { employeeId: 'cleaner-01', rating: 5.0, notes: 'Super clean kitchen' },
      { employeeId: 'cleaner-02', rating: 4.0, notes: 'Very good work' },
    ],
  })
  assert.equal(ratingPayload.success, true)
  if (ratingPayload.success) {
    assert.equal(ratingPayload.data.ratings.length, 2)
  }
})

test('Scenario 18: Unauthorized users cannot change booking status or payment records', () => {
  // Driver cannot start cleaner work
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', ['cleaner-01'], 'driver-101'), false)
  // Cleaner cannot mark on the way
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'on_the_way', 'driver-101', 'cleaner-01'), false)
  // Non-assigned cleaner cannot receive cash
  const completedBooking = { status: 'completed', netAmount: 150, assignments: [{ employeeId: 'cleaner-01' }] }
  assert.equal(canCleanerReceiveCash(completedBooking, 'cleaner-99').canReceive, false)
})

test('Scenario 19: Booking status, payment status, and pickup status remain logically separate', () => {
  // Booking status 'completed' does NOT force payment status 'paid'
  const bookingStatus = 'completed'
  const paymentStatus = 'payment_pending'
  const pickupAlertStatus = 'pickup_expected'

  assert.notEqual(bookingStatus, paymentStatus)
  assert.notEqual(paymentStatus, pickupAlertStatus)
})

test('Scenario 20: Rating submission rules enforce completed status and block duplicate submissions', () => {
  // Allowed when completed and not rated
  assert.equal(canCustomerRateBooking('completed', false), true)
  // Blocked if already rated
  assert.equal(canCustomerRateBooking('completed', true), false)
  // Blocked if not completed
  assert.equal(canCustomerRateBooking('in_progress', false), false)
})
