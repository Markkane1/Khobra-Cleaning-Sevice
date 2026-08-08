import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'

const entry = resolve('apps/realtime/index.ts')
const tsx = resolve('node_modules/tsx/dist/cli.mjs')

for (const missing of ['AUTH_SECRET', 'REALTIME_SECRET']) {
  test(`realtime fails closed without ${missing}`, () => {
    const env = { ...process.env, AUTH_SECRET: 'test-auth-secret', REALTIME_SECRET: 'test-realtime-secret' }
    delete env[missing]
    const result = spawnSync(process.execPath, [tsx, entry], { env, encoding: 'utf8', timeout: 10_000 })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, new RegExp(`${missing} must be configured`))
  })
}
