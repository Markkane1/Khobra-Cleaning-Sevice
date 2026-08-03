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
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const items = await paymentService.getPayments(tenant.id)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'accountant', 'manager'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreatePaymentSchema.parse(body)
    
    const { payment, invoiceUpdate } = await paymentService.processPayment(tenant.id, validatedData)
    
    if (invoiceUpdate) {
      broadcast('payment:created', { 
        amount: validatedData.amount, 
        method: validatedData.method, 
        invoiceNo: invoiceUpdate.invoiceNo, 
        invoiceStatus: invoiceUpdate.newStatus 
      })
    }
    
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}


