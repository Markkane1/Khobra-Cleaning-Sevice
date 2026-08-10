import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db, notifyBookingStatusChange } from '@repo/db'
import { CleanerCompleteBookingSchema, calculateMultiServicePricing, canCleanerCompleteBooking } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { apiErrorResponse } from '@/lib/api-error'

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
          assignments: { select: { id: true, employeeId: true, startedAt: true, employee: { select: { userId: true, user: { select: { name: true } } } } } },
          service: { select: { id: true, name: true, baseRate: true, withMaterialsRate: true } },
          items: { include: { service: { select: { id: true, name: true, baseRate: true, withMaterialsRate: true } } } },
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

      // 1. Update Booking Status & completedAt
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'completed',
          completedAt: completionTime,
          updatedAt: completionTime,
        },
      })

      // 2. Update Assignments with completedAt & actualHours
      const updatedAssignments = await Promise.all(booking.assignments.map(assignment => {
        const hours = assignment.startedAt ? Math.max(0.5, Math.round(((completionTime.getTime() - assignment.startedAt.getTime()) / 3_600_000) * 10) / 10) : booking.duration
        return tx.assignment.update({
          where: { id: assignment.id },
          data: {
            status: 'completed',
            completedAt: completionTime,
            actualHours: hours,
          },
        })
      }))

      // Calculate actual total hours worked
      const avgActualHours = updatedAssignments.reduce((acc, curr) => acc + (curr.actualHours || booking.duration), 0) / (updatedAssignments.length || 1)
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: auth.session.tenantId }, select: { taxRate: true } })
      const itemServices = booking.items.flatMap(item => item.service ? [{ ...item.service, includesMaterials: item.includesMaterials }] : [])
      const services = itemServices.length
        ? itemServices.map(service => ({ id: service.id, name: service.name, baseRate: Number(service.includesMaterials ? service.withMaterialsRate : service.baseRate), includesMaterials: service.includesMaterials }))
        : booking.service ? [{ id: booking.service.id, name: booking.service.name, baseRate: Number(booking.service.baseRate), includesMaterials: false }] : []
      if (!services.length) throw new Error('Booking has no billable service')
      const pricing = calculateMultiServicePricing(services, updatedAssignments.length, avgActualHours, Number(booking.materialsCost), Number(booking.discount), Number(tenant.taxRate))

      // 3. Record BookingStatusHistory
      const statusHistory = await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          previousStatus,
          newStatus: 'completed',
          changedBy: `cleaner: ${cleaner.user.name}`,
          changedByUserId: auth.session.userId,
          changedByRole: 'cleaner',
          reason: validated.notes || 'Marked completed by assigned cleaner',
          createdAt: completionTime,
        },
      })

      // 4. Issue Invoice with actual worked hours repricing
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
            subtotal: pricing.subtotal,
            taxAmount: pricing.taxAmount,
            totalAmount: pricing.netAmount,
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

    broadcast('booking:updated', { bookingId: result.booking.id, bookingNo: result.booking.bookingNo, status: 'completed' }, auth.session.tenantId)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to complete booking', missing: 'Booking or cleaner not found', domainErrorStatus: 400 })
  }
}
