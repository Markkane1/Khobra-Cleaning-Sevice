import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, PrismaPaymentRepository } from '@repo/db'
import { PaymentService } from '@repo/application'
import { ReopenPaymentSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

const paymentRepository = new PrismaPaymentRepository(db)
const paymentService = new PaymentService(paymentRepository)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = ReopenPaymentSchema.parse(body)

    const result = await paymentService.reopenPayment(
      auth.session.tenantId,
      auth.session.userId,
      validatedData
    )

    broadcast('payment:updated', { bookingId: validatedData.bookingId, status: 'reopened' })
    broadcast('booking:updated', { bookingId: validatedData.bookingId })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid reopen request' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Payment reopening failed' }, { status: error.status || 400 })
  }
}
