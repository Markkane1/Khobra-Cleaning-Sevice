import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaVendorRepository } from '@repo/db'
import { VendorService } from '@repo/application'
import { CreateVendorSchema, UpdateVendorSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// ponytail: single vendor service instance
const vendorRepository = new PrismaVendorRepository(db)
const vendorService = new VendorService(vendorRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    
    const vendors = await vendorService.getVendors(auth.session.tenantId)
    return NextResponse.json(vendors)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateVendorSchema.parse(body)
    
    const vendor = await vendorService.createVendor(auth.session.tenantId, validatedData)
    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    console.error('Create vendor error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateVendorSchema.parse(body)
    
    if (!validatedData.id) return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 })
    
    const updated = await vendorService.updateVendor(auth.session.tenantId, validatedData)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update vendor error:', error)
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
    
    await vendorService.deleteVendor(auth.session.tenantId, id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

