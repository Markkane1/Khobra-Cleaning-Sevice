import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, PrismaPaymentRepository } from '@repo/db'
import { PaymentService } from '@repo/application'
import { CleanerReceiveCashSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

const paymentRepository = new PrismaPaymentRepository(db)
const paymentService = new PaymentService(paymentRepository)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['cleaner', 'admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const data = CleanerReceiveCashSchema.parse(body)

    const result = await paymentService.cleanerReceiveCash(
      auth.session.tenantId,
      auth.session.userId,
      data.bookingId,
      data.remarks
    )

    broadcast('payment:updated', { bookingId: data.bookingId, status: 'paid' })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid cash receipt data' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to record cash payment' }, { status: 400 })
  }
}
