import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^DATABASE_URL=(.*)$/)
  if (match) process.env.DATABASE_URL ||= match[1].replace(/^"|"$/g, '')
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const schema = `migration_rehearsal_${randomUUID().replaceAll('-', '')}`
const url = new URL(process.env.DATABASE_URL)
url.searchParams.set('schema', schema)
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'inherit', shell: process.platform === 'win32' })
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
try {
  if (result.status !== 0) throw new Error('Migration rehearsal failed')
  console.log(`Migration rehearsal passed in isolated schema ${schema}`)
} finally {
  if (!/^migration_rehearsal_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe rehearsal schema name')
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await db.$disconnect()
}
