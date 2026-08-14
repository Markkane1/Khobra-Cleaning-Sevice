import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { AssignRoleSchema, ResetUserPasswordSchema } from '@repo/core'
import { hashPassword } from '@repo/db/password'
import { randomBytes } from 'crypto'
import { broadcast } from '@/lib/broadcast'
import { apiErrorResponse } from '@/lib/api-error'

const roles = [
  { id: 'admin', name: 'Administrator', isSystem: true, description: 'Full system administration' },
  { id: 'driver', name: 'Driver', isSystem: true, description: 'Assigned transport and expenses' },
  { id: 'customer', name: 'Customer', isSystem: true, description: 'Personal bookings and payments' },
  { id: 'cleaner', name: 'Cleaner', isSystem: true, description: 'Assigned cleaning work and attendance' },
]

const permissions = {
  admin: ['dashboard', 'services', 'customers', 'employees', 'bookings', 'finance', 'dispatch', 'inventory', 'reports', 'complaints', 'settings', 'attendance', 'payroll', 'branches', 'rbac', 'notifications', 'profile'],
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
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { userId, role } = AssignRoleSchema.parse(await req.json())
    const user = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE "tenantId" = ${auth.session.tenantId} AND role = 'admin' FOR UPDATE`
      const target = await tx.user.findFirst({ where: { id: userId, tenantId: auth.session.tenantId } })
      if (!target) throw Object.assign(new Error('User not found'), { status: 404 })
      if (target.role === 'admin' && target.status === 'active' && role !== 'admin' && await tx.user.count({ where: { tenantId: auth.session.tenantId, role: 'admin', status: 'active' } }) <= 1) {
        throw Object.assign(new Error('The tenant must retain at least one active administrator'), { status: 409 })
      }
      const profile = role === 'customer'
        ? await tx.customer.findFirst({ where: { userId: target.id, tenantId: auth.session.tenantId, status: 'active', deletedAt: null }, select: { id: true } })
        : role === 'cleaner'
          ? await tx.employee.findFirst({ where: { userId: target.id, tenantId: auth.session.tenantId, status: 'active', deletedAt: null }, select: { id: true } })
          : role === 'driver'
            ? await tx.driver.findFirst({ where: { userId: target.id, tenantId: auth.session.tenantId, status: { in: ['active', 'AVAILABLE'] }, deletedAt: null }, select: { id: true } })
            : true
      if (!profile) throw Object.assign(new Error(`Create a ${role} profile before assigning this role`), { status: 409 })
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { role, sessionVersion: { increment: 1 } },
        select: { id: true, name: true, email: true, role: true, status: true },
      })
      await tx.pushSubscription.updateMany({ where: { userId: target.id }, data: { active: false } })
      await tx.nativePushToken.updateMany({ where: { userId: target.id }, data: { active: false } })
      return updated
    })
    broadcast('session:revoked', {}, auth.session.tenantId, user.id)
    return NextResponse.json({ success: true, user })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Role update failed' })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { userId } = ResetUserPasswordSchema.parse(await req.json())
    const target = await db.user.findFirst({ where: { id: userId, tenantId: auth.session.tenantId, status: 'active' } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const temporaryPassword = randomBytes(12).toString('base64url')
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(temporaryPassword), sessionVersion: { increment: 1 } } }),
      db.pushSubscription.updateMany({ where: { userId: target.id }, data: { active: false } }),
      db.nativePushToken.updateMany({ where: { userId: target.id }, data: { active: false } }),
    ])
    broadcast('session:revoked', {}, auth.session.tenantId, target.id)
    return NextResponse.json({ temporaryPassword })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Password reset failed' })
  }
}

export function POST() {
  return NextResponse.json({ error: 'Custom roles are disabled. Use Admin, Driver, Customer, or Cleaner.' }, { status: 405 })
}

export function DELETE() {
  return NextResponse.json({ error: 'The four system roles cannot be deleted.' }, { status: 405 })
}
