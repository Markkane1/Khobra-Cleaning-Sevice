import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaBookingRepository } from '@repo/db'
import { AssignEmployeesSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const bookingRepository = new PrismaBookingRepository(db)

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


    const updatedBooking = await bookingRepository.assignEmployees(
      auth.session.tenantId,
      validated.bookingId,
      validated.employeeIds || [],
      validated.autoAssign,
      { userId: auth.session.userId, role: 'admin', name: auth.session.name }
    )

    broadcast('booking:updated', {
      bookingNo: updatedBooking.bookingNo,
      status: updatedBooking.status,
    }, auth.session.tenantId)

    return NextResponse.json(updatedBooking, { status: 200 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to assign cleaners', missing: 'Booking or cleaner not found', relatedRecord: 'A selected booking or cleaner no longer exists', domainErrorStatus: 400 })
  }
}
