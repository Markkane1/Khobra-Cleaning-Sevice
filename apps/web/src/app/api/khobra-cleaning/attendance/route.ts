import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaAttendanceRepository } from '@repo/db'
import { CreateAttendanceSchema, UpdateAttendanceSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const attendanceRepository = new PrismaAttendanceRepository(db)
const fail = (error: unknown) => apiErrorResponse(error, { fallback: 'Attendance request failed', missing: 'Attendance record not found' })

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'cleaner'])
    if ('response' in auth) return auth.response
    const records = await attendanceRepository.findManyByTenant(auth.session.tenantId)
    if (auth.session.role === 'admin') return NextResponse.json(records)
    const cleaner = await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    return NextResponse.json(records.filter(record => record.employeeId === cleaner?.id))
  } catch (error) {
    return fail(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'cleaner'])
    if ('response' in auth) return auth.response
    const validated = CreateAttendanceSchema.parse(await req.json())
    const cleaner = auth.session.role === 'cleaner'
      ? await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      : await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, id: validated.employeeId } })
    if (!cleaner) return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 403 })
    const record = await attendanceRepository.create(auth.session.tenantId, { ...validated, employeeId: cleaner.id })
    broadcast('attendance:created', { employeeId: record.employeeId, status: record.status, date: record.date }, auth.session.tenantId)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'cleaner'])
    if ('response' in auth) return auth.response
    const validated = UpdateAttendanceSchema.parse(await req.json())
    const existing = await db.attendance.findFirst({ where: { id: validated.id, tenantId: auth.session.tenantId }, include: { employee: { select: { userId: true } } } })
    if (!existing) return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    if (auth.session.role === 'cleaner' && existing.employee.userId !== auth.session.userId) return NextResponse.json({ error: 'You may only update your own attendance' }, { status: 403 })
    const updated = await attendanceRepository.update(auth.session.tenantId, validated.id, validated)
    broadcast('attendance:updated', { employeeId: updated.employeeId, status: updated.status, date: updated.date }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const existing = await db.attendance.findFirst({ where: { id, tenantId: auth.session.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    await attendanceRepository.delete(auth.session.tenantId, id)
    broadcast('attendance:deleted', { status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return fail(error)
  }
}
