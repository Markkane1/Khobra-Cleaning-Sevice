import assert from 'node:assert/strict'
import test from 'node:test'
import { signUp } from './auth.ts'

const input = { name: 'Test Customer', email: 'test@example.com', phone: '+971501234567', password: 'password123', confirmPassword: 'password123', privacyPolicyAccepted: true, turnstileToken: 'token' }

test('mobile signup sends the privacy-policy acknowledgement required by the API', async () => {
  let sent
  const gateway = { signUp: async value => { sent = value; return { token: 'token' } } }
  const store = { write: async () => {} }
  await signUp(gateway, store, input)
  assert.equal(sent.privacyPolicyAccepted, true)
  await assert.rejects(() => signUp(gateway, store, { ...input, privacyPolicyAccepted: false }), /Privacy Policy/)
})
