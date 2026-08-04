import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PrismaDriverRepository } from '@repo/db/src/repositories/PrismaDriverRepository'
import { DriverService } from '@repo/application/src/drivers/DriverService'
import { CreateDriverSchema, UpdateDriverSchema } from '@repo/core/src/drivers/schema'
import { requireAuth } from '@/lib/auth'

// Dependency Injection
const driverRepository = new PrismaDriverRepository(db as any)
const driverService = new DriverService(driverRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const drivers = await driverService.getDrivers(auth.session.tenantId)
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
    
    const driver = await driverService.createDriver(auth.session.tenantId, validatedData)
    
    return NextResponse.json(driver, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create driver' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateDriverSchema.parse(body)
    if (!await db.driver.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    
    const updated = await driverService.updateDriver(validatedData)
    
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update driver' }, { status: 500 })
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
    
    await driverService.deleteDriver(id)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete driver' }, { status: 500 })
  }
}
