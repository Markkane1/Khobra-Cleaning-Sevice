import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db, notifyBookingStatusChange } from '@repo/db'
import { CleanerCompleteBookingSchema, canCleanerCompleteBooking } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['cleaner'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validated = CleanerCompleteBookingSchema.parse(body)

    const cleaner = await db.employee.findFirst({
      where: { tenantId: auth.session.tenantId, userId: auth.session.userId },
      include: { user: { select: { name: true } } },
    })

    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 403 })
    }

    const result = await db.$transaction(async tx => {
      // Row lock booking
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${validated.bookingId} FOR UPDATE`)

      const booking = await tx.booking.findFirst({
        where: { id: validated.bookingId, tenantId: auth.session.tenantId },
        include: {
          customer: { select: { userId: true, user: { select: { name: true } } } },
          assignments: { select: { employeeId: true, employee: { select: { userId: true, user: { select: { name: true } } } } } },
        },
      })

      if (!booking) {
        throw Object.assign(new Error('Booking not found'), { status: 404 })
      }

      const assignedCleanerIds = booking.assignments.map(a => a.employeeId)
      if (!assignedCleanerIds.includes(cleaner.id)) {
        throw Object.assign(new Error('Only a cleaner assigned to this booking may mark it as completed'), { status: 403 })
      }

      if (!canCleanerCompleteBooking(booking.status, 'completed', assignedCleanerIds, cleaner.id)) {
        throw Object.assign(new Error('Booking can only be completed when it is currently In Progress'), { status: 400 })
      }

      const completionTime = new Date()
      const previousStatus = booking.status

      // 1. Update Booking Status
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'completed',
          updatedAt: completionTime,
        },
      })

      // 2. Update Assignments with completedAt
      await tx.assignment.updateMany({
        where: { bookingId: booking.id },
        data: {
          status: 'completed',
          completedAt: completionTime,
        },
      })

      // 3. Record BookingStatusHistory
      const statusHistory = await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          previousStatus,
          newStatus: 'completed',
          changedBy: `cleaner: ${cleaner.user.name} (${auth.session.userId})`,
          reason: validated.notes || 'Marked completed by assigned cleaner',
          createdAt: completionTime,
        },
      })

      // 4. Issue Invoice if not already existing (paidAmount: 0, payment remains pending)
      const existingInvoice = await tx.invoice.findFirst({ where: { bookingId: booking.id } })
      if (!existingInvoice) {
        const invoiceNo = `INV-${booking.bookingNo}`
        await tx.invoice.create({
          data: {
            tenantId: auth.session.tenantId,
            invoiceNo,
            bookingId: booking.id,
            customerId: booking.customerId,
            status: 'issued',
            issuedAt: completionTime,
            subtotal: booking.netAmount,
            totalAmount: booking.netAmount,
            paidAmount: 0,
            discount: booking.discount || 0,
          },
        })
      }

      return {
        booking: updatedBooking,
        statusHistory,
        completedBy: cleaner.user.name,
        completedAt: completionTime,
        previousStatus,
        newStatus: 'completed',
      }
    })

    await notifyBookingStatusChange(db, result.booking.id, result.statusHistory)

    broadcast('booking:updated', { bookingId: result.booking.id, bookingNo: result.booking.bookingNo, status: 'completed' })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid completion request' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to complete booking' }, { status: error.status || 400 })
  }
}
