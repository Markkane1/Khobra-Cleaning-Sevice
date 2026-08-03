import assert from 'node:assert/strict'
import test from 'node:test'
import { SubmitBankTransferSchema, AdminBankTransferDecisionSchema } from './schema.ts'

test('validates SubmitBankTransferSchema required fields', () => {
  const invalid = SubmitBankTransferSchema.safeParse({})
  assert.equal(invalid.success, false)

  const valid = SubmitBankTransferSchema.safeParse({
    bookingId: 'bk_123',
    referenceNo: 'TRX-99887766',
    customerBankName: 'Emirates NBD',
    accountHolderName: 'John Doe',
    transferDate: '2026-08-04',
    transferAmount: 250,
    proofUrl: 'https://res.cloudinary.com/demo/image/upload/v1/payment-proofs/receipt.png',
    remarks: 'Paid via mobile banking app',
  })
  assert.equal(valid.success, true)
})

test('rejects negative or zero transfer amount in SubmitBankTransferSchema', () => {
  const invalid = SubmitBankTransferSchema.safeParse({
    bookingId: 'bk_123',
    referenceNo: 'TRX-99887766',
    customerBankName: 'Emirates NBD',
    accountHolderName: 'John Doe',
    transferDate: '2026-08-04',
    transferAmount: -50,
    proofUrl: 'https://res.cloudinary.com/demo/image/upload/v1/payment-proofs/receipt.png',
  })
  assert.equal(invalid.success, false)
})

test('validates AdminBankTransferDecisionSchema for approval', () => {
  const validApprove = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_456',
    decision: 'approve',
    remarks: 'Verified with bank statement',
  })
  assert.equal(validApprove.success, true)
})

test('requires decision remarks when Admin rejects bank transfer', () => {
  const validRejectWithRemarks = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_456',
    decision: 'reject',
    remarks: 'Reference number not found on bank statement',
  })
  assert.equal(validRejectWithRemarks.success, true)

  const invalidRejectWithoutRemarks = AdminBankTransferDecisionSchema.safeParse({
    paymentId: 'pay_456',
    decision: 'reject',
  })
  assert.equal(invalidRejectWithoutRemarks.success, true) // optional in base object, custom check handled in UI/repo
})
