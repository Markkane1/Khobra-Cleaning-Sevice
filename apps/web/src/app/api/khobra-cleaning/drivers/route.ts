import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PrismaDriverRepository } from '@repo/db/src/repositories/PrismaDriverRepository'
import { CreateDriverSchema, UpdateDriverSchema } from '@repo/core/src/drivers/schema'
import { requireAuth } from '@/lib/auth'

const driverRepository = new PrismaDriverRepository(db as any)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const drivers = await driverRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(auth.session.role === 'driver' ? drivers.filter(driver => driver.userId === auth.session.userId) : drivers)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Create driver failed:', error)
    return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Update driver failed:', error)
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Delete driver failed:', error)
    return NextResponse.json({ error: 'Failed to delete driver' }, { status: 500 })
  }
}
