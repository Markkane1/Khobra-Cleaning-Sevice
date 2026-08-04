import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { isRoleId, requireAuth } from '@/lib/auth'
import { hashPassword } from '@repo/db/password'
import { randomBytes } from 'crypto'

const roles = [
  { id: 'admin', name: 'Administrator', isSystem: true, description: 'Full system administration' },
  { id: 'driver', name: 'Driver', isSystem: true, description: 'Assigned transport and expenses' },
  { id: 'customer', name: 'Customer', isSystem: true, description: 'Personal bookings and payments' },
  { id: 'cleaner', name: 'Cleaner', isSystem: true, description: 'Assigned cleaning work and attendance' },
]

const permissions = {
  admin: ['dashboard', 'services', 'customers', 'employees', 'bookings', 'finance', 'driver_expenses', 'dispatch', 'inventory', 'reports', 'complaints', 'settings', 'attendance', 'payroll', 'branches', 'rbac', 'notifications', 'profile'],
  driver: ['dashboard', 'bookings', 'dispatch', 'driver_expenses', 'profile'],
  customer: ['dashboard', 'bookings', 'complaints', 'profile'],
  cleaner: ['dashboard', 'attendance', 'bookings', 'complaints', 'profile'],
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const users = auth.session.role === 'admin' ? await db.user.findMany({
    where: { tenantId: auth.session.tenantId },
    select: { id: true, name: true, email: true, phone: true, role: true, status: true },
    orderBy: { createdAt: 'desc' },
  }) : []
  return NextResponse.json({ roles, permissions, users })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  const { userId, role } = await req.json()
  if (typeof userId !== 'string' || typeof role !== 'string' || !isRoleId(role)) return NextResponse.json({ error: 'A user and one of the four supported roles are required.' }, { status: 400 })
  const target = await db.user.findFirst({ where: { id: userId, tenantId: auth.session.tenantId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const user = await db.user.update({
    where: { id: target.id },
    data: { role, sessionVersion: { increment: 1 } },
    select: { id: true, name: true, email: true, role: true, status: true },
  })
  return NextResponse.json({ success: true, user })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['admin'])
  if ('response' in auth) return auth.response
  const { userId } = await req.json()
  if (typeof userId !== 'string') return NextResponse.json({ error: 'User is required.' }, { status: 400 })
  const target = await db.user.findFirst({ where: { id: userId, tenantId: auth.session.tenantId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const temporaryPassword = randomBytes(12).toString('base64url')
  await db.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(temporaryPassword), status: 'active', sessionVersion: { increment: 1 } } })
  return NextResponse.json({ temporaryPassword })
}

export function POST() {
  return NextResponse.json({ error: 'Custom roles are disabled. Use Admin, Driver, Customer, or Cleaner.' }, { status: 405 })
}

export function DELETE() {
  return NextResponse.json({ error: 'The four system roles cannot be deleted.' }, { status: 405 })
}
