import test from 'node:test'
import assert from 'node:assert/strict'
import { CreateTripSchema, UpdateTripSchema } from './schema.ts'

test('trip stops accept persisted sort order', () => {
  const created = CreateTripSchema.parse({ driverId: 'driver-1', date: '2026-08-11', stops: [{ address: 'Dubai Marina', sortOrder: 2 }] })
  assert.equal(created.stops[0].sortOrder, 2)
  const updated = UpdateTripSchema.parse({ id: 'trip-1', stops: [{ id: 'stop-1', sortOrder: 0 }] })
  assert.equal(updated.stops[0].sortOrder, 0)
})
