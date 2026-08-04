import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@repo/db'
import { CreateDriverExpenseSchema, DecideDriverExpenseSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const include = { driver: { include: { user: { select: { name: true } } } }, trip: { select: { id: true, date: true, status: true } } } as const

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const driver = auth.session.role === 'driver' ? await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } }) : null
    if (auth.session.role === 'driver' && !driver) return NextResponse.json([])
    return NextResponse.json(await db.driverExpense.findMany({
      where: { tenantId: auth.session.tenantId, ...(driver ? { driverId: driver.id } : {}) },
      include,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    }))
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load driver expenses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const data = CreateDriverExpenseSchema.parse(await req.json())
    const driver = auth.session.role === 'driver'
      ? await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      : data.driverId ? await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, id: data.driverId } }) : null
    if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 403 })
    if (data.tripId && !await db.trip.findFirst({ where: { id: data.tripId, tenantId: auth.session.tenantId, driverId: driver.id } })) {
      return NextResponse.json({ error: 'The selected trip is not assigned to this driver' }, { status: 403 })
    }
    return NextResponse.json(await db.driverExpense.create({
      data: {
        tenantId: auth.session.tenantId,
        driverId: driver.id,
        tripId: data.tripId,
        category: data.category,
        typeDetail: data.typeDetail,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        expenseDate: data.expenseDate,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
        submittedBy: auth.session.userId,
      },
      include,
    }), { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid expense' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to add expense' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const data = DecideDriverExpenseSchema.parse(await req.json())
    const expense = await db.driverExpense.findFirst({ where: { id: data.id, tenantId: auth.session.tenantId } })
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    if (expense.status !== 'pending') return NextResponse.json({ error: 'Only pending expenses can be approved or rejected' }, { status: 409 })
    return NextResponse.json(await db.driverExpense.update({
      where: { id: expense.id },
      data: { status: data.decision, decisionRemarks: data.remarks, approvedBy: auth.session.userId, approvedAt: new Date() },
      include,
    }))
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid decision' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Failed to review expense' }, { status: 500 })
  }
}
