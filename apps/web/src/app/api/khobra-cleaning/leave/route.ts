import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaLeaveRepository } from '@repo/db'
import { LeaveService } from '@repo/application'
import { CreateLeaveSchema, UpdateLeaveSchema } from '@repo/core'

const leaveRepository = new PrismaLeaveRepository(db)
const leaveService = new LeaveService(leaveRepository)

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const records = await leaveService.getLeaveRecords(tenant.id)
    return NextResponse.json(records)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch leave records' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateLeaveSchema.parse(body)
    
    const leave = await leaveService.createLeaveRecord(tenant.id, validatedData)
    return NextResponse.json(leave, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create leave record' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateLeaveSchema.parse(body)
    
    const updated = await leaveService.updateLeaveRecord(validatedData)
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update leave record' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Leave record ID required' }, { status: 400 })
    
    await leaveService.deleteLeaveRecord(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete leave record' }, { status: 500 })
  }
}
