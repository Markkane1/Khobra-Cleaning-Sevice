import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaPaymentRepository } from '@repo/db'
import { PaymentService } from '@repo/application'
import { CreatePaymentSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// Dependency Injection
const paymentRepository = new PrismaPaymentRepository(db)
const paymentService = new PaymentService(paymentRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    let items = await paymentService.getPayments(auth.session.tenantId)
    if (auth.session.role === 'customer') items = items.filter((item: any) => item.invoice?.customer?.userId === auth.session.userId)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  return NextResponse.json({ error: 'Confirmed payments can only be created by assigned-cleaner cash receipt or Admin bank-transfer approval.' }, { status: 405 })
}


