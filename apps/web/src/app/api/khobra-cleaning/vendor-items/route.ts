import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaVendorItemRepository } from '@repo/db'
import { CreateVendorItemSchema, UpdateVendorItemSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const vendorItemRepository = new PrismaVendorItemRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const vendorId = searchParams.get('vendorId')
    
    const items = await vendorItemRepository.findMany(auth.session.tenantId, vendorId)
    return NextResponse.json(items)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch vendor items' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateVendorItemSchema.parse(body)
    
    const vendorItem = await vendorItemRepository.create(auth.session.tenantId, validatedData)
    return NextResponse.json(vendorItem, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to link vendor item', conflict: 'This vendor is already linked to the inventory item', relatedRecord: 'The selected vendor or inventory item no longer exists' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateVendorItemSchema.parse(body)
    
    const updated = await vendorItemRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    return NextResponse.json(updated)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update vendor item', missing: 'Vendor item link not found', conflict: 'This vendor is already linked to the inventory item' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await vendorItemRepository.delete(auth.session.tenantId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete vendor item', missing: 'Vendor item link not found' })
  }
}

