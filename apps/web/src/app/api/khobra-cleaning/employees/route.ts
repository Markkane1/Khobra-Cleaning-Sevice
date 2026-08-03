import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaEmployeeRepository } from '@repo/db'
import { EmployeeService } from '@repo/application'
import { CreateEmployeeSchema, UpdateEmployeeSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const employeeRepository = new PrismaEmployeeRepository(db)
const employeeService = new EmployeeService(employeeRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const employees = await employeeService.getEmployees(tenant.id)
    return NextResponse.json(employees)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateEmployeeSchema.parse(body)
    
    const employee = await employeeService.createEmployee(tenant.id, validatedData)
    
    broadcast('employee:created', { employeeCode: employee.employeeCode, name: employee.user.name })
    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateEmployeeSchema.parse(body)
    
    const updated = await employeeService.updateEmployee(validatedData)
    
    broadcast('employee:updated', { employeeCode: updated.employeeCode, name: updated.user.name })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    const employee = await db.employee.findUnique({ where: { id } })
    await employeeService.deleteEmployee(id)
    
    broadcast('employee:updated', { employeeCode: employee?.employeeCode, status: 'deleted' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
