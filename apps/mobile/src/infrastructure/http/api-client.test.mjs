import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.__DEV__ = false
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test'
const { request, setUnauthorizedHandler } = await import('./api-client.ts')

test('mobile requests reject HTTP errors and revoke unauthorized sessions', async t => {
  let revoked = false
  setUnauthorizedHandler(() => { revoked = true })
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Session expired' }, { status: 401 }))
  await assert.rejects(request('/private', {}, 'token'), { message: 'Session expired' })
  assert.equal(revoked, true)
  setUnauthorizedHandler()
})
