import test from 'node:test'
import assert from 'node:assert/strict'
import { SignupSchema } from './schema.ts'

const signup = { name: 'Test Customer', email: 'test@example.com', phone: '+971501234567', password: 'password123', confirmPassword: 'password123', turnstileToken: 'token' }
test('signup requires privacy-policy acknowledgement', () => {
  assert.equal(SignupSchema.safeParse({ ...signup, privacyPolicyAccepted: false }).success, false)
  assert.equal(SignupSchema.safeParse({ ...signup, privacyPolicyAccepted: true }).success, true)
})
