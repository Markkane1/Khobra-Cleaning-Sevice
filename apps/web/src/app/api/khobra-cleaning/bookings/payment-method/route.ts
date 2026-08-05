import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, PrismaPaymentRepository } from '@repo/db'
import { SelectPaymentMethodSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

const paymentRepository = new PrismaPaymentRepository(db)

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = SelectPaymentMethodSchema.parse(body)

    const selection = await paymentRepository.selectPaymentMethod(
      auth.session.tenantId,
      auth.session.userId,
      validatedData
    )

    const status = validatedData.method === 'cash' ? 'cash_selected' : 'payment_pending'
    broadcast('payment:updated', { status, bookingId: validatedData.bookingId }, auth.session.tenantId)
    broadcast('booking:updated', { bookingId: validatedData.bookingId }, auth.session.tenantId)

    return NextResponse.json({ ...selection, method: validatedData.method, status }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payment selection data' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Payment method selection failed' }, { status: error.status || 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { paymentId, remarks } = await req.json()
    if (!paymentId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })

    const updatedPayment = await paymentRepository.verifyCashPayment(
      auth.session.tenantId,
      auth.session.userId,
      paymentId,
      remarks
    )

    broadcast('payment:updated', { paymentId: updatedPayment.id, status: updatedPayment.status }, auth.session.tenantId)
    broadcast('booking:updated', { invoiceId: updatedPayment.invoiceId }, auth.session.tenantId)

    return NextResponse.json(updatedPayment)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Cash verification failed' }, { status: error.status || 400 })
  }
}
