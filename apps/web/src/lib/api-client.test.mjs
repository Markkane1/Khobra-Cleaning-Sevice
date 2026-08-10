import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest } from './api-client.ts'

test('apiRequest returns successful JSON responses', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }))
  assert.deepEqual(await apiRequest('/test'), { ok: true })
})

test('apiRequest shows field-level validation issues', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    error: 'Invalid request',
    issues: [
      { field: 'name', message: 'Name is required' },
      { field: 'email', message: 'Enter a valid email' },
    ],
  }, { status: 400 }))

  await assert.rejects(apiRequest('/test'), { message: 'Name is required Enter a valid email' })
})

test('apiRequest falls back to a status-aware message for invalid error bodies', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream failed', { status: 502 }))
  await assert.rejects(apiRequest('/test'), { message: 'Request failed (502)' })
})
