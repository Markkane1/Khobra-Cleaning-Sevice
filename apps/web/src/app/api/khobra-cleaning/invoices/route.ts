import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaInvoiceRepository } from '@repo/db'
import { InvoiceService } from '@repo/application'
import { CreateInvoiceSchema, UpdateInvoiceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// Dependency Injection
const invoiceRepository = new PrismaInvoiceRepository(db)
const invoiceService = new InvoiceService(invoiceRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'accountant', 'manager', 'customer'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    let items = await invoiceService.getInvoices(tenant.id)
    if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      items = items.filter((item: any) => item.customerId === customer?.id)
    }
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
    const validatedData = CreateInvoiceSchema.parse(body)
    
    const invoice = await invoiceService.createInvoice(tenant.id, validatedData)
    
    broadcast('invoice:created', { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'accountant', 'manager'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateInvoiceSchema.parse(body)
    
    const updated = await invoiceService.updateInvoice(validatedData)
    
    broadcast('invoice:updated', { invoiceNo: (updated as any).invoiceNo, status: updated.status })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update invoice error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}


