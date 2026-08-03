import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PrismaDriverRepository } from '@repo/db/src/repositories/PrismaDriverRepository'
import { DriverService } from '@repo/application/src/drivers/DriverService'
import { CreateDriverSchema, UpdateDriverSchema } from '@repo/core/src/drivers/schema'

// Dependency Injection
const driverRepository = new PrismaDriverRepository(db as any)
const driverService = new DriverService(driverRepository)

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const drivers = await driverService.getDrivers(tenant.id)
    return NextResponse.json(drivers)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateDriverSchema.parse(body)
    
    const driver = await driverService.createDriver(tenant.id, validatedData)
    
    return NextResponse.json(driver, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create driver' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateDriverSchema.parse(body)
    
    const updated = await driverService.updateDriver(validatedData)
    
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update driver' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Driver ID required' }, { status: 400 })
    
    await driverService.deleteDriver(id)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete driver' }, { status: 500 })
  }
}
