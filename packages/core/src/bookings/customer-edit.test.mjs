import assert from 'node:assert/strict'
import test from 'node:test'
import { canCustomerEditBooking } from './schema.ts'

test('customer booking edits close exactly six hours before the tenant-local date and time', () => {
  const now = new Date('2026-08-13T00:00:00.000Z')

  assert.equal(canCustomerEditBooking('2026-08-13', '10:00', 'Asia/Dubai', now), true)
  assert.equal(canCustomerEditBooking('2026-08-13', '09:59', 'Asia/Dubai', now), false)
  assert.equal(canCustomerEditBooking('2026-08-14', '08:00', 'Asia/Dubai', now), true)
})
