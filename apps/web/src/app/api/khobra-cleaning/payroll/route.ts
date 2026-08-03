import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaPayrollRepository } from '@repo/db'
import { PayrollService } from '@repo/application'
import { UpdatePayrollSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const payrollRepository = new PrismaPayrollRepository(db)
const payrollService = new PayrollService(payrollRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'accountant', 'manager'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ records: [], summary: {} })
    
    const result = await payrollService.getPayrollSummary(tenant.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Payroll fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch payroll' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'accountant'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })

    const body = await req.json()
    const validatedData = UpdatePayrollSchema.parse(body)
    
    const record = await payrollService.updatePayrollRecord(tenant.id, validatedData)
    
    return NextResponse.json({ success: true, record })
  } catch (error: any) {
    console.error('Payroll update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update payroll' }, { status: 500 })
  }
}
