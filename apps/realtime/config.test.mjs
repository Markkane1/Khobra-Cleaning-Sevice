import assert from 'node:assert/strict'
import test from 'node:test'

const { requiredEnv } = await import('./config.ts')

for (const missing of ['AUTH_SECRET', 'REALTIME_SECRET']) {
  test(`realtime fails closed without ${missing}`, () => {
    const value = process.env[missing]
    delete process.env[missing]
    try {
      assert.throws(() => requiredEnv(missing), new RegExp(`${missing} must be configured`))
    } finally {
      if (value === undefined) delete process.env[missing]
      else process.env[missing] = value
    }
  })
}
