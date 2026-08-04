import { Prisma } from '@prisma/client'
import { db } from '@repo/db/client'

export async function checkRateLimit(key: string, limit = 20, windowMs = 60_000): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)
  const [bucket] = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `)
  const count = bucket?.count ?? limit + 1
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}
