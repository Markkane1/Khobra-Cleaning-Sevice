import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('booking material consumption cannot make stock negative', () => {
  const source = readFileSync(new URL('./repositories/PrismaBookingRepository.ts', import.meta.url), 'utf8')
  assert.match(source, /currentStock:\s*\{\s*gte:\s*reservation\.requiredQuantity\s*\}/)
  assert.match(source, /if\s*\(!changed\.count\)\s*throw new Error\('Insufficient material stock/)
})

test('recurring booking creation commits every occurrence atomically', () => {
  const source = readFileSync(new URL('./repositories/PrismaBookingRepository.ts', import.meta.url), 'utf8')
  const create = source.slice(source.indexOf('async create('), source.indexOf('async update('))
  const transaction = create.indexOf('this.db.$transaction(async tx =>')
  const occurrences = create.indexOf('for (let index = 0; index < occurrenceDates.length; index++)')
  assert.ok(transaction >= 0 && transaction < occurrences)
  assert.equal(create.match(/this\.db\.\$transaction/g)?.length, 1)
  assert.match(create, /for \(const result of results\) await notifyBookingStatusChange/)
})
