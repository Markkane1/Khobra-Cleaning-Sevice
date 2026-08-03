import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaVendorRepository } from '@repo/db'
import { VendorService } from '@repo/application'
import { CreateVendorSchema, UpdateVendorSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const vendorRepository = new PrismaVendorRepository(db)
const vendorService = new VendorService(vendorRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const vendors = await vendorService.getVendors(tenant.id)
    return NextResponse.json(vendors)
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
    const validatedData = CreateVendorSchema.parse(body)
    
    const vendor = await vendorService.createVendor(tenant.id, validatedData)
    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    console.error('Create vendor error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateVendorSchema.parse(body)
    
    if (!validatedData.id) return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 })
    
    const updated = await vendorService.updateVendor(validatedData)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update vendor error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await vendorService.deleteVendor(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
