import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaServiceRepository } from '@repo/db'
import { CreateServiceSchema, UpdateServiceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const serviceRepository = new PrismaServiceRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const services = await serviceRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(services)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch services' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    
    const body = await req.json()
    const validatedData = CreateServiceSchema.parse(body)
    
    const item = await serviceRepository.create(auth.session.tenantId, validatedData)
    broadcast('service:created', { name: item.name, category: item.category }, auth.session.tenantId)
    
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to create service', conflict: 'A service with these details already exists' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateServiceSchema.parse(body)
    
    const item = await serviceRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    broadcast('service:updated', { name: (item as any).name, status: item.status }, auth.session.tenantId)
    
    return NextResponse.json(item)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update service', conflict: 'A service with these details already exists', missing: 'Service not found' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await serviceRepository.delete(auth.session.tenantId, id)
    broadcast('service:updated', { status: 'deleted' }, auth.session.tenantId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete service', missing: 'Service not found', relatedRecord: 'This service is used by a booking and cannot be deleted' })
  }
}
