import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const ExpenseSchema = z.object({
  category: z.enum(['cleaning_material', 'salary', 'other']),
  description: z.string().trim().min(2).max(200),
  amount: z.coerce.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).optional(),
  expenseDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  return NextResponse.json(await db.businessExpense.findMany({ where: { tenantId: auth.session.tenantId }, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }] }))
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const data = ExpenseSchema.parse(await req.json())
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: auth.session.tenantId }, select: { currency: true } })
    return NextResponse.json(await db.businessExpense.create({ data: { ...data, currency: (data.currency || tenant.currency).toUpperCase(), tenantId: auth.session.tenantId, createdBy: auth.session.userId } }), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error.message || 'Failed to record expense' }, { status: 400 })
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
