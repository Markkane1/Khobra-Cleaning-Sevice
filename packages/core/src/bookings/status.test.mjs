import assert from 'node:assert/strict'
import test from 'node:test'
import { canCleanerStartWork, canCleanerSubmitCompletionTiming, canDriverTransitionToOnTheWay, canEditFinalizedBooking, isTerminalBookingStatus, isValidStatusTransition, shouldGeneratePickupAlert } from './schema.ts'

test('booking workflow requires Scheduled → On the Way → In Progress → Completed', () => {
  assert.equal(isValidStatusTransition('scheduled', 'on_the_way'), true)
  assert.equal(isValidStatusTransition('on_the_way', 'in_progress'), true)
  assert.equal(isValidStatusTransition('in_progress', 'completed'), true)
  assert.equal(isValidStatusTransition('scheduled', 'in_progress'), false)
  assert.equal(isValidStatusTransition('on_the_way', 'completed'), false)
  assert.equal(isValidStatusTransition('completed', 'on_the_way'), false)
  assert.equal(isValidStatusTransition('scheduled', 'cancelled'), true)
  assert.equal(isValidStatusTransition('on_the_way', 'no_show'), true)
  assert.equal(isValidStatusTransition('confirmed', 'on_the_way'), true)
  assert.equal(isValidStatusTransition('unknown', 'scheduled'), false)
})

test('only the assigned driver can mark a Scheduled booking On the Way', () => {
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'on_the_way', 'driver-1', 'driver-1'), true)
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'on_the_way', 'driver-1', 'driver-2'), false)
  assert.equal(canDriverTransitionToOnTheWay('on_the_way', 'on_the_way', 'driver-1', 'driver-1'), false)
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'in_progress', 'driver-1', 'driver-1'), false)
  assert.equal(canDriverTransitionToOnTheWay('scheduled', 'completed', 'driver-1', 'driver-1'), false)
})

test('completed, cancelled, and no-show bookings remain terminal', () => {
  assert.equal(isTerminalBookingStatus('completed'), true)
  assert.equal(isTerminalBookingStatus('cancelled'), true)
  assert.equal(isTerminalBookingStatus('no_show'), true)
  assert.equal(isTerminalBookingStatus('pending_assignment'), false)
})

test('finalized bookings keep their commercial details immutable', () => {
  assert.equal(canEditFinalizedBooking('completed', ['discount']), false)
  assert.equal(canEditFinalizedBooking('cancelled', ['scheduledDate']), false)
  assert.equal(canEditFinalizedBooking('completed', ['notes']), true)
  assert.equal(canEditFinalizedBooking('scheduled', ['discount']), true)
})

test('any assigned cleaner can start an On the Way booking once', () => {
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', ['cleaner-1', 'cleaner-2'], 'cleaner-2'), true)
  assert.equal(canCleanerStartWork('on_the_way', 'in_progress', ['cleaner-1'], 'cleaner-2'), false)
  assert.equal(canCleanerStartWork('scheduled', 'in_progress', ['cleaner-1'], 'cleaner-1'), false)
  assert.equal(canCleanerStartWork('in_progress', 'in_progress', ['cleaner-1'], 'cleaner-1'), false)
})

test('only an assigned cleaner can submit completion timing while In Progress', () => {
  assert.equal(canCleanerSubmitCompletionTiming('in_progress', ['cleaner-1'], 'cleaner-1'), true)
  assert.equal(canCleanerSubmitCompletionTiming('in_progress', ['cleaner-1'], 'cleaner-2'), false)
  assert.equal(canCleanerSubmitCompletionTiming('scheduled', ['cleaner-1'], 'cleaner-1'), false)
  assert.equal(canCleanerSubmitCompletionTiming('completed', ['cleaner-1'], 'cleaner-1'), false)
})

test('pickup alerts are generated only for initial Yes and No to Yes', () => {
  assert.equal(shouldGeneratePickupAlert(undefined, true), true)
  assert.equal(shouldGeneratePickupAlert(false, true), true)
  assert.equal(shouldGeneratePickupAlert(true, true), false)
  assert.equal(shouldGeneratePickupAlert(true, false), false)
})
