import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidStatusTransition } from './schema.ts'

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
