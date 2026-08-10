import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaPayrollRepository } from '@repo/db'
import { PayrollService } from '@repo/application'
import { UpdatePayrollSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const payrollRepository = new PrismaPayrollRepository(db)
const payrollService = new PayrollService(payrollRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const result = await payrollService.getPayrollSummary(auth.session.tenantId)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch payroll' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdatePayrollSchema.parse(body)
    
    const record = await payrollService.updatePayrollRecord(auth.session.tenantId, validatedData)
    
    return NextResponse.json({ success: true, record })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update payroll', missing: 'Employee or payroll record not found', conflict: 'Payroll for this employee and month already exists' })
  }
}
