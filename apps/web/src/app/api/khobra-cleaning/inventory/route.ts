import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaInventoryItemRepository } from '@repo/db'
import { CreateInventoryItemSchema, UpdateInventoryItemSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const inventoryItemRepository = new PrismaInventoryItemRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const items = await inventoryItemRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateInventoryItemSchema.parse(body)
    
    const item = await inventoryItemRepository.create(auth.session.tenantId, validatedData)
    
    broadcast('inventory:updated', { name: item.name, action: 'created' }, auth.session.tenantId)
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Create inventory item error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateInventoryItemSchema.parse(body)
    
    const updated = await inventoryItemRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    
    broadcast('inventory:updated', { name: updated.name, action: 'updated' }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update inventory item error:', error)
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
    
    await inventoryItemRepository.delete(auth.session.tenantId, id)
    
    broadcast('inventory:updated', { action: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

