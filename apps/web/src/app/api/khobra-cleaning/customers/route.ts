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
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json([])
    
    const customers = await customerService.getCustomers(tenant.id)
    return NextResponse.json(customers)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager', 'supervisor'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateCustomerSchema.parse(body)
    
    const customer = await customerService.createCustomer(tenant.id, validatedData)
    
    broadcast('customer:created', { name: customer.user.name, city: customer.city })
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateCustomerSchema.parse(body)
    
    const updated = await customerService.updateCustomer(validatedData)
    
    broadcast('customer:updated', { name: updated.user.name, city: updated.city })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await customerService.deleteCustomer(id)
    
    broadcast('customer:updated', { status: 'deleted' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

