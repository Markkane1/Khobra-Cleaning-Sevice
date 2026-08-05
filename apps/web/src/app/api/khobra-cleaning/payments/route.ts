import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaPaymentRepository } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const paymentRepository = new PrismaPaymentRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    let items = await paymentRepository.getPayments(auth.session.tenantId)
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


