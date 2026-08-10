import { NextResponse } from 'next/server'
import { db } from '@repo/db'
import { getPublicTenant } from '@/lib/public-tenant'

export async function GET() {
  const tenant = await getPublicTenant()
  if (!tenant) return NextResponse.json({ services: [], business: null })

  const services = await db.service.findMany({
    where: { tenantId: tenant.id, status: 'active' },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      baseRate: true,
      withMaterialsRate: true,
      minDuration: true,
      galleryImages: true,
      heroImages: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    services,
    business: {
      name: tenant.name,
      currency: tenant.currency,
      firstBookingTime: tenant.firstBookingTime || '08:00',
      lastWorkingTime: tenant.lastWorkingTime || '20:00',
    },
  })
}
