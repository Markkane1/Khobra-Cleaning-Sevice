import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaServiceRepository } from '@repo/db'
import { ServiceService } from '@repo/application'
import { CreateServiceSchema, UpdateServiceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const serviceRepository = new PrismaServiceRepository(db)
const serviceService = new ServiceService(serviceRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json([])
    
    const services = await serviceService.getServices(tenant.id)
    return NextResponse.json(services)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateServiceSchema.parse(body)
    
    const item = await serviceService.createService(tenant.id, validatedData)
    broadcast('service:created', { name: item.name, category: item.category })
    
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Create service error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateServiceSchema.parse(body)
    
    const item = await serviceService.updateService(validatedData)
    broadcast('service:updated', { name: (item as any).name, status: item.status })
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('Update service error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    const existing = await serviceService.getServices('fake').catch(() => null); // get info
    // Broadcast needs name but clean architecture delete doesn't return the item by default, let's keep it simple
    await serviceService.deleteService(id)
    broadcast('service:updated', { status: 'deleted' })
    
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
