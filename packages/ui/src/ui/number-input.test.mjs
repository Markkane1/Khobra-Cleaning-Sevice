import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeInteger, stepInteger } from './number-input.ts'

test('numeric inputs stay whole, non-empty, and non-negative', () => {
  assert.equal(normalizeInteger('-3'), 0)
  assert.equal(normalizeInteger('4.9'), 4)
  assert.equal(normalizeInteger(''), null)
  assert.equal(stepInteger('', 1), 1)
  assert.equal(stepInteger(0, -1), 0)
  assert.equal(stepInteger(4, 1, 0, 4), 4)
  assert.equal(normalizeInteger(2, 0, -1), 0)
})
