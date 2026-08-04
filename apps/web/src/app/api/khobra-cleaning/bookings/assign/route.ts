import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaBookingRepository } from '@repo/db'
import { BookingService } from '@repo/application'
import { AssignEmployeesSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const bookingRepository = new PrismaBookingRepository(db)
const bookingService = new BookingService(bookingRepository)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validated = AssignEmployeesSchema.parse(body)
    const booking = await db.booking.findFirst({ where: { id: validated.bookingId, tenantId: auth.session.tenantId } })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    if (['in_progress', 'completed', 'cancelled'].includes(booking.status)) {
      return NextResponse.json({ error: `Cannot re-assign employees when booking status is '${booking.status}'` }, { status: 400 })
    }


    const updatedBooking = await bookingService.assignEmployees(
      validated.bookingId,
      validated.employeeIds || [],
      validated.autoAssign
    )

    broadcast('booking:updated', {
      bookingNo: updatedBooking.bookingNo,
      status: updatedBooking.status,
    })

    return NextResponse.json(updatedBooking, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid assignment data' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Assign cleaners error:', error)
    return NextResponse.json({ error: 'Failed to assign cleaners' }, { status: 500 })
  }
}
