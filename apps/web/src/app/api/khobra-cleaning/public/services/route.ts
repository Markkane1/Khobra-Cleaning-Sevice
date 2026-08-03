import { NextResponse } from 'next/server'
import { db } from '@repo/db'

export async function GET() {
  const tenant = await db.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!tenant) return NextResponse.json({ services: [], business: null })

  const services = await db.service.findMany({
    where: { tenantId: tenant.id, status: 'active' },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      baseRate: true,
      minDuration: true,
      galleryImages: true,
      heroImages: true,
      requiresMaterials: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    services,
    business: {
      name: tenant.name,
      firstBookingTime: tenant.firstBookingTime || '08:00',
      lastWorkingTime: tenant.lastWorkingTime || '20:00',
    },
  })
}
