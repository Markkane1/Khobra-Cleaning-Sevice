import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { db, PrismaLeaveRepository } from '@repo/db'
import { LeaveService } from '@repo/application'
import { CreateLeaveSchema, UpdateLeaveSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const leaveService = new LeaveService(new PrismaLeaveRepository(db))
const fail = (error: unknown) => NextResponse.json({ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Leave request failed' }, { status: error instanceof ZodError ? 400 : 500 })

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'cleaner'])
    if ('response' in auth) return auth.response
    const records = await leaveService.getLeaveRecords(auth.session.tenantId)
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
    const validated = CreateLeaveSchema.parse(await req.json())
    const cleaner = auth.session.role === 'cleaner'
      ? await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      : await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, id: validated.employeeId } })
    if (!cleaner) return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 403 })
    return NextResponse.json(await leaveService.createLeaveRecord(auth.session.tenantId, { ...validated, employeeId: cleaner.id }), { status: 201 })
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const validated = UpdateLeaveSchema.parse(await req.json())
    if (!await db.leaveRecord.findFirst({ where: { id: validated.id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Leave record not found' }, { status: 404 })
    return NextResponse.json(await leaveService.updateLeaveRecord(validated))
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Leave record ID required' }, { status: 400 })
    if (!await db.leaveRecord.findFirst({ where: { id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Leave record not found' }, { status: 404 })
    await leaveService.deleteLeaveRecord(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return fail(error)
  }
}
