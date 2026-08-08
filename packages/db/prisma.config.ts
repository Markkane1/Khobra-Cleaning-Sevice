import { defineConfig } from 'prisma/config'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

for (const envFile of [resolve(import.meta.dirname, '.env'), resolve(import.meta.dirname, '../../apps/web/.env')]) {
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile)
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
