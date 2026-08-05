import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaCustomerRepository } from '@repo/db'
import { CustomerService } from '@repo/application'
import { CreateCustomerSchema, UpdateCustomerSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// Dependency Injection
const customerRepository = new PrismaCustomerRepository(db)
const customerService = new CustomerService(customerRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    const customers = await customerService.getCustomers(auth.session.tenantId)
    return NextResponse.json(auth.session.role === 'customer' ? customers.filter(customer => customer.userId === auth.session.userId) : customers)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateCustomerSchema.parse(body)
    
    const customer = await customerService.createCustomer(auth.session.tenantId, validatedData)
    
    broadcast('customer:created', { name: customer.user.name, city: customer.city }, auth.session.tenantId)
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateCustomerSchema.parse(body)
    const existing = await db.customer.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    if (auth.session.role === 'customer' && existing.userId !== auth.session.userId) return NextResponse.json({ error: 'You may only update your own profile' }, { status: 403 })
    
    const updated = await customerService.updateCustomer(auth.session.tenantId, validatedData)
    
    broadcast('customer:updated', { name: updated.user.name, city: updated.city }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    if (!await db.customer.findFirst({ where: { id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    await customerService.deleteCustomer(auth.session.tenantId, id)
    
    broadcast('customer:updated', { status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

