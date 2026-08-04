import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RateBookingEmployeesSchema,
  canCustomerRateBooking,
  isValidRating,
} from './schema.ts'

test('validates 1 to 5 star rating scale in RateBookingEmployeesSchema', () => {
  const invalidRating = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_1',
    overallRating: 6, // invalid > 5
    ratings: [{ employeeId: 'emp_1', rating: 5 }],
  })
  assert.equal(invalidRating.success, false)

  const validRating = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_1',
    overallRating: 4,
    overallComment: 'Great cleaning team!',
    ratings: [
      { employeeId: 'emp_1', rating: 5, notes: 'Very punctual and thorough' },
      { employeeId: 'emp_2', rating: 4, notes: 'Friendly and efficient' },
    ],
  })
  assert.equal(validRating.success, true)

  const halfStarRating = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_1',
    overallRating: 4.5,
    ratings: [{ employeeId: 'emp_1', rating: 4.5 }],
  })
  assert.equal(halfStarRating.success, false)

  const duplicateCleaner = RateBookingEmployeesSchema.safeParse({
    bookingId: 'bk_1',
    overallRating: 5,
    ratings: [{ employeeId: 'emp_1', rating: 5 }, { employeeId: 'emp_1', rating: 4 }],
  })
  assert.equal(duplicateCleaner.success, false)
})

test('canCustomerRateBooking enforces completed status and single submission rule', () => {
  assert.equal(canCustomerRateBooking('completed', false), true)
  assert.equal(canCustomerRateBooking('completed', true), false) // already rated
  assert.equal(canCustomerRateBooking('in_progress', false), false) // not completed
  assert.equal(canCustomerRateBooking('scheduled', false), false)
})
