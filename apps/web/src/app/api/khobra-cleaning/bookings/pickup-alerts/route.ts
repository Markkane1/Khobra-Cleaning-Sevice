import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { deliverPickupAlert } from '@/lib/pickup-alerts'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'driver'])
  if ('response' in auth) return auth.response
  const driver = auth.session.role === 'driver' ? await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } }) : null
  if (auth.session.role === 'driver' && !driver) return NextResponse.json([])
  return NextResponse.json(await db.bookingPickupAlert.findMany({
    where: { booking: { tenantId: auth.session.tenantId }, ...(driver ? { driverId: driver.id } : {}) },
    include: { booking: { select: { bookingNo: true } }, driver: { include: { user: { select: { name: true } } } } },
    orderBy: { generatedAt: 'desc' },
  }))
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { bookingId } = z.object({ bookingId: z.string().min(1) }).parse(await req.json())
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`)
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId: auth.session.tenantId },
        select: {
          id: true, bookingNo: true, status: true, address: true, area: true, city: true, endTime: true,
          customer: { select: { address: true, area: true, city: true } },
          driver: { select: { id: true, userId: true } },
          assignments: { select: { employee: { select: { user: { select: { name: true } } } } } },
        },
      })
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })
      if (booking.status !== 'in_progress') throw new Error('Pickup alerts are only available while the booking is In Progress')
      if (!booking.driver) throw new Error('Assign a driver before sending a pickup alert')
      const location = [booking.address || booking.customer.address, booking.area || booking.customer.area, booking.city || booking.customer.city].filter(Boolean).join(', ') || 'Location not provided'
      const alert = await tx.bookingPickupAlert.create({
        data: {
          bookingId: booking.id,
          driverId: booking.driver.id,
          reason: 'manual_resend',
          customerLocation: location,
          scheduledEndTime: booking.endTime,
          assignedCleanerNames: booking.assignments.map(assignment => assignment.employee.user.name).join(', '),
          generatedBy: auth.session.userId,
        },
        include: { booking: { select: { bookingNo: true } } },
      })
      return { alert, driverUserId: booking.driver.userId }
    })
    await deliverPickupAlert(result.alert, result.driverUserId, auth.session.tenantId)
    broadcast('dispatch:updated', { bookingNo: result.alert.booking.bookingNo, pickupAlertId: result.alert.id }, auth.session.tenantId)
    return NextResponse.json(result.alert, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to send pickup alert', missing: 'Booking or driver not found', domainErrorStatus: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json())
    const alert = await db.bookingPickupAlert.findFirst({ where: { id, booking: { tenantId: auth.session.tenantId } }, include: { driver: true } })
    if (!alert) return NextResponse.json({ error: 'Pickup alert not found' }, { status: 404 })
    if (auth.session.role === 'driver' && alert.driver.userId !== auth.session.userId) return NextResponse.json({ error: 'This pickup alert is assigned to another driver' }, { status: 403 })
    await db.bookingPickupAlert.updateMany({ where: { id, viewedAt: null }, data: { viewedAt: new Date() } })
    return NextResponse.json(await db.bookingPickupAlert.findUnique({ where: { id } }))
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to mark pickup alert viewed', missing: 'Pickup alert not found', domainErrorStatus: 400 })
  }
}
