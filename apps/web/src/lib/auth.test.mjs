import assert from 'node:assert/strict'
import test from 'node:test'

process.env.AUTH_SECRET = 'test-only-auth-secret-with-sufficient-entropy'
const { createSessionToken, hashPassword, verifyPassword, verifySessionToken } = await import('./auth-crypto.ts')

const user = { userId: 'u1', tenantId: 't1', email: 'user@example.com', role: 'admin', name: 'User', sessionVersion: 0 }

test('sessions reject tampering and expiry; passwords require the original secret', () => {
  const token = createSessionToken(user)
  const verified = verifySessionToken(token)
  assert.deepEqual({ ...verified, expiresAt: undefined }, { ...user, expiresAt: undefined })
  assert.ok(verified.expiresAt > Date.now())
  assert.equal(verifySessionToken(`${token.slice(0, -1)}x`), null)
  assert.equal(verifySessionToken(createSessionToken(user, Math.floor(Date.now() / 1000) - 1)), null)

  const passwordHash = hashPassword('correct-password')
  assert.equal(verifyPassword('correct-password', passwordHash), true)
  assert.equal(verifyPassword('wrong-password', passwordHash), false)
})
