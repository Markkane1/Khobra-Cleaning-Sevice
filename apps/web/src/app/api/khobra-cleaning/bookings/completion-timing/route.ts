import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@repo/db'
import { CompletionTimingResponseSchema, canCleanerSubmitCompletionTiming, shouldGeneratePickupAlert } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { deliverPickupAlert } from '@/lib/pickup-alerts'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['cleaner'])
    if ('response' in auth) return auth.response
    const data = CompletionTimingResponseSchema.parse(await req.json())
    const cleaner = await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!cleaner) return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 403 })

    const response = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${data.bookingId} FOR UPDATE`)
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, tenantId: auth.session.tenantId },
        select: {
          id: true, bookingNo: true, status: true, address: true, area: true, city: true, endTime: true,
          customer: { select: { address: true, area: true, city: true } },
          driver: { select: { id: true, userId: true } },
          assignments: { select: { employeeId: true, employee: { select: { user: { select: { name: true } } } } } },
        },
      })
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })
      if (!booking.assignments.some(assignment => assignment.employeeId === cleaner.id))
        throw Object.assign(new Error('Only a cleaner assigned to this booking may submit this response'), { status: 403 })
      if (!canCleanerSubmitCompletionTiming(booking.status, booking.assignments.map(assignment => assignment.employeeId), cleaner.id))
        throw Object.assign(new Error('Completion timing can only be confirmed while the booking is In Progress'), { status: 400 })
      const previous = await tx.bookingCompletionTimingResponse.findFirst({ where: { bookingId: booking.id }, orderBy: { createdAt: 'desc' } })
      const record = await tx.bookingCompletionTimingResponse.create({
          data: { bookingId: booking.id, employeeId: cleaner.id, withinScheduledTime: data.withinScheduledTime },
          include: { employee: { include: { user: { select: { name: true } } } } },
        })
      const location = [booking.address || booking.customer.address, booking.area || booking.customer.area, booking.city || booking.customer.city].filter(Boolean).join(', ') || 'Location not provided'
      const alert = shouldGeneratePickupAlert(previous?.withinScheduledTime, data.withinScheduledTime) && booking.driver
        ? await tx.bookingPickupAlert.create({
            data: {
              bookingId: booking.id,
              driverId: booking.driver.id,
              timingResponseId: record.id,
              reason: 'completion_expected',
              customerLocation: location,
              scheduledEndTime: booking.endTime,
              assignedCleanerNames: booking.assignments.map(assignment => assignment.employee.user.name).join(', '),
              generatedBy: `cleaner: ${auth.session.name} (${auth.session.userId})`,
            },
            include: { booking: { select: { bookingNo: true } } },
          })
        : null
      return {
        bookingNo: booking.bookingNo,
        driverUserId: booking.driver?.userId,
        record,
        alert,
      }
    })

    if (response.alert && response.driverUserId) await deliverPickupAlert(response.alert, response.driverUserId, auth.session.tenantId)
    broadcast('booking:updated', { bookingNo: response.bookingNo, message: 'Completion timing updated' })
    if (response.alert) broadcast('dispatch:updated', { bookingNo: response.bookingNo, pickupAlertId: response.alert.id })
    return NextResponse.json(response.record, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid response' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to record completion timing' }, { status: error.status || 400 })
  }
}
