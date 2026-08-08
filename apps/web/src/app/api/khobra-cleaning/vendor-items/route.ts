import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaVendorItemRepository } from '@repo/db'
import { CreateVendorItemSchema, UpdateVendorItemSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const vendorItemRepository = new PrismaVendorItemRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const vendorId = searchParams.get('vendorId')
    
    const items = await vendorItemRepository.findMany(auth.session.tenantId, vendorId)
    return NextResponse.json(items)
  } catch (error: any) {
    console.error('Fetch vendor items failed:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor items' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Link vendor item failed:', error)
    return NextResponse.json({ error: 'Failed to link vendor item' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Update vendor item failed:', error)
    return NextResponse.json({ error: 'Failed to update vendor item' }, { status: 500 })
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
  } catch (error: any) {
    console.error('Delete vendor item failed:', error)
    return NextResponse.json({ error: 'Failed to delete vendor item' }, { status: 500 })
  }
}

