import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaAttendanceRepository } from '@repo/db'
import { AttendanceService } from '@repo/application'
import { CreateAttendanceSchema, UpdateAttendanceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const attendanceRepository = new PrismaAttendanceRepository(db)
const attendanceService = new AttendanceService(attendanceRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const attendances = await attendanceService.getAttendances(tenant.id)
    return NextResponse.json(attendances)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateAttendanceSchema.parse(body)
    
    const record = await attendanceService.createAttendance(tenant.id, validatedData)
    
    broadcast('attendance:created', { employeeId: record.employeeId, status: record.status, date: record.date })
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Create attendance error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateAttendanceSchema.parse(body)
    
    const updated = await attendanceService.updateAttendance(validatedData)
    
    broadcast('attendance:updated', { employeeId: updated.employeeId, status: updated.status, date: updated.date })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update attendance error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await attendanceService.deleteAttendance(id)
    
    broadcast('attendance:deleted', { status: 'deleted' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
