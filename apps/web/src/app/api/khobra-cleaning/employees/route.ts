import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaEmployeeRepository } from '@repo/db'
import { EmployeeService } from '@repo/application'
import { CreateEmployeeSchema, UpdateEmployeeSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// ponytail: single employee service instance
const employeeRepository = new PrismaEmployeeRepository(db)
const employeeService = new EmployeeService(employeeRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    if (auth.session.role === 'customer' || auth.session.role === 'driver') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employees = await employeeService.getEmployees(auth.session.tenantId)
    if (auth.session.role === 'cleaner') {
      return NextResponse.json(employees.filter(employee => employee.userId === auth.session.userId))
    }

    return NextResponse.json(employees)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateEmployeeSchema.parse(body)
    
    const employee = await employeeService.createEmployee(auth.session.tenantId, validatedData)
    
    broadcast('employee:created', { employeeCode: employee.employeeCode, name: employee.user.name }, auth.session.tenantId)
    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateEmployeeSchema.parse(body)
    if (!await db.employee.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 })
    
    const updated = await employeeService.updateEmployee(validatedData)
    
    broadcast('employee:updated', { employeeCode: updated.employeeCode, name: updated.user.name }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    const employee = await db.employee.findFirst({ where: { id, tenantId: auth.session.tenantId } })
    if (!employee) return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 })
    await employeeService.deleteEmployee(id)
    
    broadcast('employee:updated', { employeeCode: employee?.employeeCode, status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
