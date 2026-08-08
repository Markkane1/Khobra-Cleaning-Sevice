import assert from 'node:assert/strict'
import test from 'node:test'

const { getClientIp } = await import('./client-ip.ts')
const request = value => ({ headers: new Headers({ 'x-forwarded-for': value }) })

test('client IP uses only the first validated address from the configured proxy header', () => {
  process.env.TRUSTED_IP_HEADER = 'x-forwarded-for'
  assert.equal(getClientIp(request('203.0.113.8, 10.0.0.2')), '203.0.113.8')
  assert.equal(getClientIp(request('not-an-ip, 10.0.0.2')), 'anonymous')
  assert.equal(getClientIp(request('x'.repeat(100))), 'anonymous')
})
