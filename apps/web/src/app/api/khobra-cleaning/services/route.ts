import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaServiceRepository } from '@repo/db'
import { ServiceService } from '@repo/application'
import { CreateServiceSchema, UpdateServiceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// ponytail: direct repository & service instantiation for route
const serviceRepository = new PrismaServiceRepository(db)
const serviceService = new ServiceService(serviceRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const services = await serviceService.getServices(auth.session.tenantId)
    return NextResponse.json(services)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    
    const body = await req.json()
    const validatedData = CreateServiceSchema.parse(body)
    
    const item = await serviceService.createService(auth.session.tenantId, validatedData)
    broadcast('service:created', { name: item.name, category: item.category }, auth.session.tenantId)
    
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Create service error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateServiceSchema.parse(body)
    
    const item = await serviceService.updateService(auth.session.tenantId, validatedData)
    broadcast('service:updated', { name: (item as any).name, status: item.status }, auth.session.tenantId)
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('Update service error:', error)
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
    
    await serviceService.deleteService(auth.session.tenantId, id)
    broadcast('service:updated', { status: 'deleted' }, auth.session.tenantId)
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
