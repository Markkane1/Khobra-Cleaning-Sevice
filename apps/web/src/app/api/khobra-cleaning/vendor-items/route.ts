import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaVendorItemRepository } from '@repo/db'
import { VendorItemService } from '@repo/application'
import { CreateVendorItemSchema, UpdateVendorItemSchema } from '@repo/core'

const vendorItemRepository = new PrismaVendorItemRepository(db)
const vendorItemService = new VendorItemService(vendorItemRepository)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const vendorId = searchParams.get('vendorId')
    
    const items = await vendorItemService.getVendorItems(vendorId)
    return NextResponse.json(items)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch vendor items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = CreateVendorItemSchema.parse(body)
    
    const vendorItem = await vendorItemService.createVendorItem(validatedData)
    return NextResponse.json(vendorItem, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to link vendor item' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateVendorItemSchema.parse(body)
    
    const updated = await vendorItemService.updateVendorItem(validatedData)
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update vendor item' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await vendorItemService.deleteVendorItem(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete vendor item' }, { status: 500 })
  }
}
