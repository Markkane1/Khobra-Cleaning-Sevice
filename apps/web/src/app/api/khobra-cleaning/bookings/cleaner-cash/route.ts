import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaPaymentRepository } from '@repo/db'
import { CleanerReceiveCashSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { apiErrorResponse } from '@/lib/api-error'

const paymentRepository = new PrismaPaymentRepository(db)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['cleaner'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const data = CleanerReceiveCashSchema.parse(body)

    const result = await paymentRepository.cleanerReceiveCash(
      auth.session.tenantId,
      auth.session.userId,
      data.bookingId,
      data.remarks
    )

    broadcast('payment:updated', { bookingId: data.bookingId, status: 'paid' }, auth.session.tenantId)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to record cash payment', missing: 'Booking, invoice, or payment not found', conflict: 'This cash payment has already been recorded', domainErrorStatus: 400 })
  }
}
