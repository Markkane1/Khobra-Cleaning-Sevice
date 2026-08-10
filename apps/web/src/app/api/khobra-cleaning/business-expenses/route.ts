import { NextRequest, NextResponse } from 'next/server'
import { CreateBusinessExpenseSchema } from '@repo/core'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  return NextResponse.json(await db.businessExpense.findMany({ where: { tenantId: auth.session.tenantId }, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }] }))
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const data = CreateBusinessExpenseSchema.parse(await req.json())
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: auth.session.tenantId }, select: { currency: true } })
    return NextResponse.json(await db.businessExpense.create({ data: { ...data, currency: (data.currency || tenant.currency).toUpperCase(), tenantId: auth.session.tenantId, createdBy: auth.session.userId } }), { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to record expense', domainErrorStatus: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  const id = new URL(req.url).searchParams.get('id')
  const expense = id ? await db.businessExpense.findFirst({ where: { id, tenantId: auth.session.tenantId } }) : null
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  await db.businessExpense.delete({ where: { id: expense.id } })
  return NextResponse.json({ success: true })
}
