import assert from 'node:assert/strict'
import test from 'node:test'
import { notificationTarget } from './notification-target.ts'

test('booking notifications open bookings and general alerts open notifications', () => {
  assert.equal(notificationTarget('booking_status'), 'bookings')
  assert.equal(notificationTarget('dispatch'), 'bookings')
  assert.equal(notificationTarget('pickup_alert_high'), 'bookings')
  assert.equal(notificationTarget('info'), 'notifications')
})
