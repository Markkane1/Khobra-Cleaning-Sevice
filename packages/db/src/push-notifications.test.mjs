import assert from 'node:assert/strict'
import test from 'node:test'
import { isPermanentApnsFailure, isPermanentFcmFailure, nativePushConfigured } from './push-notifications.ts'

test('native push providers require every credential', () => {
  const original = { ...process.env }
  try {
    delete process.env.FIREBASE_PROJECT_ID
    delete process.env.FIREBASE_CLIENT_EMAIL
    delete process.env.FIREBASE_PRIVATE_KEY
    assert.equal(nativePushConfigured('android'), false)
    Object.assign(process.env, { FIREBASE_PROJECT_ID: 'project', FIREBASE_CLIENT_EMAIL: 'service@example.com', FIREBASE_PRIVATE_KEY: 'key' })
    assert.equal(nativePushConfigured('android'), true)

    delete process.env.APNS_KEY_ID
    delete process.env.APNS_TEAM_ID
    delete process.env.APNS_PRIVATE_KEY
    delete process.env.APNS_BUNDLE_ID
    assert.equal(nativePushConfigured('ios'), false)
    Object.assign(process.env, { APNS_KEY_ID: 'key', APNS_TEAM_ID: 'team', APNS_PRIVATE_KEY: 'private', APNS_BUNDLE_ID: 'com.khobracleaning.app' })
    assert.equal(nativePushConfigured('ios'), true)
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]
    Object.assign(process.env, original)
  }
})

test('only invalid device registrations deactivate native push tokens', () => {
  assert.equal(isPermanentFcmFailure(400, 'INVALID_ARGUMENT'), false)
  assert.equal(isPermanentFcmFailure(404, 'not found'), true)
  assert.equal(isPermanentFcmFailure(400, 'UNREGISTERED'), true)
  assert.equal(isPermanentApnsFailure(400, 'BadDeviceToken'), true)
  assert.equal(isPermanentApnsFailure(503, 'ServiceUnavailable'), false)
})
