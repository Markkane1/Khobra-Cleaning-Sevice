import assert from 'node:assert/strict'
import test from 'node:test'
import { CreateCustomerSchema, getPrimaryCustomerAddress } from './schema.ts'

test('customer creation rejects incomplete credentials', () => {
  const result = CreateCustomerSchema.safeParse({ name: ' ', email: 'invalid', temporaryPassword: 'short' })

  assert.equal(result.success, false)
  assert.deepEqual(new Set(result.error.issues.map(issue => issue.path[0])), new Set(['name', 'email', 'temporaryPassword']))
})

test('primary customer address uses the first saved address with legacy fallback', () => {
  assert.equal(getPrimaryCustomerAddress([{ label: 'Home', address: ' Villa 12 ' }], 'Old address'), 'Villa 12')
  assert.equal(getPrimaryCustomerAddress(undefined, ' Old address '), 'Old address')
  assert.equal(getPrimaryCustomerAddress([], null), '')
})
