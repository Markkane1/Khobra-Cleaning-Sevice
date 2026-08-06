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
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    let items = await invoiceService.getInvoices(auth.session.tenantId)
    if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      items = items.filter((item: any) => item.customerId === customer?.id)
    }
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateInvoiceSchema.parse(body)
    const customer = await db.customer.findFirst({ where: { id: validatedData.customerId, tenantId: auth.session.tenantId } })
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    if (validatedData.bookingId && !await db.booking.findFirst({ where: { id: validatedData.bookingId, tenantId: auth.session.tenantId, customerId: customer.id } }))
      return NextResponse.json({ error: 'Booking does not belong to this customer' }, { status: 400 })
    if (validatedData.bookingId && await db.invoice.findFirst({ where: { bookingId: validatedData.bookingId } }))
      return NextResponse.json({ error: 'This booking already has an invoice' }, { status: 409 })
    const invoice = await invoiceService.createInvoice(auth.session.tenantId, validatedData)
    
    broadcast('invoice:created', { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount }, auth.session.tenantId)
    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: error.issues?.[0]?.message || error.message || 'Failed to create invoice' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateInvoiceSchema.parse(body)
    const existing = await db.invoice.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (validatedData.status && Number(existing.paidAmount) > 0) return NextResponse.json({ error: 'Invoice status is controlled by its payment transactions' }, { status: 400 })
    const updated = await invoiceService.updateInvoice(auth.session.tenantId, validatedData)
    
    broadcast('invoice:updated', { invoiceNo: (updated as any).invoiceNo, status: updated.status }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Update invoice error:', error)
    return NextResponse.json({ error: error.issues?.[0]?.message || error.message || 'Failed to update invoice' }, { status: 400 })
  }
}


