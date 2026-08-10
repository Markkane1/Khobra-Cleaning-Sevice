import assert from 'node:assert/strict'
import test from 'node:test'
import { CreateCustomerSchema, CustomerAddressSchema, getPrimaryCustomerAddress } from './schema.ts'

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

test('customer address accepts a complete GPS pin and rejects partial coordinates', () => {
  assert.equal(CustomerAddressSchema.safeParse({ label: 'Home', address: '', city: 'Dubai', latitude: 25.2048, longitude: 55.2708 }).success, true)
  assert.equal(CustomerAddressSchema.safeParse({ label: 'Home', address: '', city: 'Dubai', latitude: 25.2048 }).success, false)
  assert.equal(getPrimaryCustomerAddress([{ address: '', latitude: 25.2048, longitude: 55.2708 }]), 'Pinned GPS location')
})
