import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canCleanerCompleteBooking,
  CleanerCompleteBookingSchema,
} from './schema.ts'

test('canCleanerCompleteBooking enforces assigned cleaner and in_progress status', () => {
  const assigned = ['cleaner-1', 'cleaner-2']

  // Valid completion
  assert.equal(canCleanerCompleteBooking('in_progress', 'completed', assigned, 'cleaner-1'), true)
  assert.equal(canCleanerCompleteBooking('in_progress', undefined, assigned, 'cleaner-2'), true)

  // Unassigned cleaner
  assert.equal(canCleanerCompleteBooking('in_progress', 'completed', assigned, 'cleaner-3'), false)

  // Invalid status
  assert.equal(canCleanerCompleteBooking('scheduled', 'completed', assigned, 'cleaner-1'), false)
  assert.equal(canCleanerCompleteBooking('on_the_way', 'completed', assigned, 'cleaner-1'), false)
  assert.equal(canCleanerCompleteBooking('completed', 'completed', assigned, 'cleaner-1'), false)
})

test('validates CleanerCompleteBookingSchema required fields', () => {
  const invalid = CleanerCompleteBookingSchema.safeParse({})
  assert.equal(invalid.success, false)

  const valid = CleanerCompleteBookingSchema.safeParse({
    bookingId: 'bk_123',
    notes: 'Completed all rooms thoroughly',
  })
  assert.equal(valid.success, true)
})
