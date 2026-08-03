import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaInventoryItemRepository } from '@repo/db'
import { InventoryItemService } from '@repo/application'
import { CreateInventoryItemSchema, UpdateInventoryItemSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const inventoryItemRepository = new PrismaInventoryItemRepository(db)
const inventoryItemService = new InventoryItemService(inventoryItemRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const items = await inventoryItemService.getInventoryItems(tenant.id)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateInventoryItemSchema.parse(body)
    
    const item = await inventoryItemService.createInventoryItem(tenant.id, validatedData)
    
    broadcast('inventory:updated', { name: item.name, action: 'created' })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Create inventory item error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateInventoryItemSchema.parse(body)
    
    const updated = await inventoryItemService.updateInventoryItem(validatedData)
    
    broadcast('inventory:updated', { name: updated.name, action: 'updated' })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update inventory item error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await inventoryItemService.deleteInventoryItem(id)
    
    broadcast('inventory:updated', { action: 'deleted' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
