import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'

for (const file of ['apps/web/.env', 'apps/web/.env.local']) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) process.env[match[1]] ||= match[2].replace(/^"|"$/g, '')
  }
}

const { checkRateLimit } = await import('./rate-limit.ts')
const db = new PrismaClient()

test('durable rate limiter atomically enforces a shared limit', async () => {
  const key = `test:${Date.now()}:${Math.random()}`
  try {
    const results = await Promise.all(Array.from({ length: 5 }, () => checkRateLimit(key, 2, 60_000)))
    assert.equal(results.filter(result => result.allowed).length, 2)
  } finally {
    await db.rateLimitBucket.deleteMany({ where: { key } })
    await db.$disconnect()
  }
})
