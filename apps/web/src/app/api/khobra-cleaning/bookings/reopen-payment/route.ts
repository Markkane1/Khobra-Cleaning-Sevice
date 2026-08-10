import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaPaymentRepository } from '@repo/db'
import { ReopenPaymentSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { apiErrorResponse } from '@/lib/api-error'

const paymentRepository = new PrismaPaymentRepository(db)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = ReopenPaymentSchema.parse(body)

    const result = await paymentRepository.reopenPayment(
      auth.session.tenantId,
      auth.session.userId,
      validatedData.bookingId,
      validatedData.reason
    )

    broadcast('payment:updated', { bookingId: validatedData.bookingId, status: 'reopened' }, auth.session.tenantId)
    broadcast('booking:updated', { bookingId: validatedData.bookingId }, auth.session.tenantId)

    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Payment reopening failed', missing: 'Booking or payment not found', conflict: 'This payment cannot be reopened', domainErrorStatus: 400 })
  }
}
