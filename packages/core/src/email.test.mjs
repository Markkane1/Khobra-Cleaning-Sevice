import assert from 'node:assert/strict'
import test from 'node:test'
import { EmailSchema } from './email.ts'

test('email input is trimmed and stored lowercase', () => {
  assert.equal(EmailSchema.parse(' Ali@Dummy.COM '), 'ali@dummy.com')
})
