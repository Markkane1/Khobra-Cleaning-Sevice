import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PrismaDriverRepository } from '@repo/db/src/repositories/PrismaDriverRepository'
import { CreateDriverSchema, UpdateDriverSchema } from '@repo/core/src/drivers/schema'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const driverRepository = new PrismaDriverRepository(db as any)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const drivers = await driverRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(auth.session.role === 'driver' ? drivers.filter(driver => driver.userId === auth.session.userId) : drivers)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch drivers' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    
    const body = await req.json()
    const validatedData = CreateDriverSchema.parse(body)
    
    const driver = await driverRepository.create(auth.session.tenantId, validatedData)
    
    return NextResponse.json(driver, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to create driver', conflict: 'A driver with this email, licence, or vehicle already exists' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateDriverSchema.parse(body)
    if (!await db.driver.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    
    const updated = await driverRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    
    return NextResponse.json(updated)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update driver', conflict: 'A driver with this email, licence, or vehicle already exists', missing: 'Driver not found' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Driver ID required' }, { status: 400 })
    if (!await db.driver.findFirst({ where: { id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    
    await driverRepository.delete(auth.session.tenantId, id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete driver', missing: 'Driver not found', relatedRecord: 'This driver is assigned to another record and cannot be deleted' })
  }
}
