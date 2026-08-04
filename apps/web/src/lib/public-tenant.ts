import { db } from '@repo/db'

export function getPublicTenant() {
  return db.tenant.findFirst({ where: { slug: process.env.PUBLIC_TENANT_SLUG || 'khobra-cleaners', status: 'active' } })
}
