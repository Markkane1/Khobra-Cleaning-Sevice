import { Prisma } from '@prisma/client'

type QueryClient = { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> }

export async function nextReference(client: QueryClient, tenantId: string, kind: string, prefix: string, width: number, initial: number) {
  const [row] = await client.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    INSERT INTO "ReferenceSequence" ("tenantId", "kind", "value")
    VALUES (${tenantId}, ${kind}, ${initial + 1})
    ON CONFLICT ("tenantId", "kind") DO UPDATE SET "value" = "ReferenceSequence"."value" + 1
    RETURNING "value"
  `)
  if (!row) throw new Error(`Failed to allocate ${kind} reference`)
  return `${prefix}-${String(row.value).padStart(width, '0')}`
}
