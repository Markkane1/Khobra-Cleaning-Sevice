import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaCustomerRepository } from '@repo/db'
import { CreateCustomerSchema, UpdateCustomerSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const customerRepository = new PrismaCustomerRepository(db)

function customerErrorResponse(error: unknown) {
  return apiErrorResponse(error, {
    fallback: 'Failed to save customer',
    conflict: 'A customer with this email already exists',
    missing: 'Customer not found',
  })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    const customers = await customerRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(auth.session.role === 'customer' ? customers.filter(customer => customer.userId === auth.session.userId) : customers)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch customers' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateCustomerSchema.parse(body)
    
    const customer = await customerRepository.create(auth.session.tenantId, validatedData)
    
    broadcast('customer:created', { name: customer.user.name, city: customer.city }, auth.session.tenantId)
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Create customer error:', error)
    return customerErrorResponse(error)
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
    
    const updated = await customerRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    
    broadcast('customer:updated', { name: updated.user.name, city: updated.city }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update customer error:', error)
    return customerErrorResponse(error)
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
    await customerRepository.delete(auth.session.tenantId, id)
    
    broadcast('customer:updated', { status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete customer', missing: 'Customer not found', relatedRecord: 'This customer has related records and cannot be deleted' })
  }
}

