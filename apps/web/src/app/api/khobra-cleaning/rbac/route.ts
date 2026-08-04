import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'dashboard', 'services', 'customers', 'employees', 'bookings',
    'finance', 'driver_expenses', 'dispatch', 'inventory', 'reports', 'complaints',
    'settings', 'attendance', 'payroll', 'branches', 'rbac', 'notifications', 'profile',
  ],
  customer: [
    'dashboard', 'bookings', 'complaints', 'profile',
  ],
  cleaner: [
    'dashboard', 'attendance', 'bookings', 'complaints', 'profile',
  ],
  driver: [
    'dashboard', 'bookings', 'dispatch', 'driver_expenses', 'profile',
  ],
}

const DEFAULT_CUSTOM_ROLES = [
  { id: 'admin', name: 'Administrator', isSystem: true, description: 'Full system access and platform management' },
  { id: 'customer', name: 'Customer', isSystem: true, description: 'Access to customer portal and personal bookings' },
  { id: 'cleaner', name: 'Cleaner', isSystem: true, description: 'Cleaning assignments and attendance tracking' },
  { id: 'driver', name: 'Driver', isSystem: true, description: 'Transport driver and trip navigation' },
]

const withEssentialRolePermissions = (permissions: Record<string, string[]>) => ({
  ...permissions,
  cleaner: [...new Set([...(permissions.cleaner || []), 'bookings', 'complaints'])],
  driver: [...new Set([...(permissions.driver || []), 'bookings', 'dispatch', 'driver_expenses'])],
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json({ roles: [], permissions: {}, users: [] })

    // Fetch custom role permissions from AppSettings
    let permSetting = await db.appSettings.findUnique({ where: { key: 'rbac_role_permissions' } })
    let rolePermissions = DEFAULT_ROLE_PERMISSIONS
    if (permSetting) {
      try {
        const saved = JSON.parse(permSetting.value)
        rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...saved }
        if (rolePermissions.admin && !rolePermissions.admin.includes('rbac')) {
          rolePermissions.admin = [...rolePermissions.admin, 'rbac']
        }
      } catch {}
    }
    rolePermissions = withEssentialRolePermissions(rolePermissions)

    // Fetch custom roles list from AppSettings
    let rolesSetting = await db.appSettings.findUnique({ where: { key: 'rbac_custom_roles' } })
    let customRoles = DEFAULT_CUSTOM_ROLES
    if (rolesSetting) {
      try {
        const savedRoles: any[] = JSON.parse(rolesSetting.value)
        customRoles = savedRoles
          .map(role => role.id === 'employee' ? { ...role, id: 'cleaner', name: 'Cleaner', description: 'Cleaning assignments and attendance tracking' } : role)
          .filter(r => ['admin', 'customer', 'cleaner', 'driver'].includes(r.id) || (!r.isSystem && !['manager', 'supervisor', 'accountant'].includes(r.id)))
      } catch {}
    }

    // Fetch all users with their current assigned roles
    const users = auth.session.role === 'admin' ? await db.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true },
      orderBy: { createdAt: 'desc' },
    }) : []

    return NextResponse.json({
      roles: customRoles,
      permissions: rolePermissions,
      users,
    })
  } catch (error: any) {
    console.error('Fetch RBAC error:', error)
    return NextResponse.json({ error: 'Failed to fetch RBAC configuration' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { id, name, description, permissions } = await req.json()
    if (!name) return NextResponse.json({ error: 'Role name required' }, { status: 400 })

    const roleId = id || name.toLowerCase().replace(/[^a-z0-9]/g, '_')

    // Fetch existing roles
    let rolesSetting = await db.appSettings.findUnique({ where: { key: 'rbac_custom_roles' } })
    let roles = DEFAULT_CUSTOM_ROLES
    if (rolesSetting) {
      try { roles = JSON.parse(rolesSetting.value) } catch {}
    }

    // Add or update role
    const existingIdx = roles.findIndex(r => r.id === roleId)
    const roleObj = { id: roleId, name, isSystem: false, description: description || '' }

    if (existingIdx >= 0) {
      roles[existingIdx] = { ...roles[existingIdx], ...roleObj }
    } else {
      roles.push(roleObj)
    }

    await db.appSettings.upsert({
      where: { key: 'rbac_custom_roles' },
      update: { value: JSON.stringify(roles) },
      create: { key: 'rbac_custom_roles', value: JSON.stringify(roles), description: 'Custom RBAC Roles List' },
    })

    // If permissions array passed, update role permissions matrix
    if (permissions && Array.isArray(permissions)) {
      let permSetting = await db.appSettings.findUnique({ where: { key: 'rbac_role_permissions' } })
      let rolePermissions = DEFAULT_ROLE_PERMISSIONS
      if (permSetting) {
        try { rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...JSON.parse(permSetting.value) } } catch {}
      }
      rolePermissions[roleId] = permissions
      rolePermissions = withEssentialRolePermissions(rolePermissions)

      await db.appSettings.upsert({
        where: { key: 'rbac_role_permissions' },
        update: { value: JSON.stringify(rolePermissions) },
        create: { key: 'rbac_role_permissions', value: JSON.stringify(rolePermissions), description: 'RBAC Permission Matrix' },
      })
    }

    return NextResponse.json({ success: true, role: roleObj }, { status: 201 })
  } catch (error: any) {
    console.error('Create role error:', error)
    return NextResponse.json({ error: 'Failed to save custom role' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()

    // Case 1: Assign Role to User { userId, role }
    if (body.userId && body.role) {
      const target = await db.user.findFirst({ where: { id: body.userId, tenantId: auth.session.tenantId } })
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      const updatedUser = await db.user.update({
        where: { id: target.id },
        data: { role: body.role },
        select: { id: true, name: true, email: true, role: true },
      })
      return NextResponse.json({ success: true, user: updatedUser })
    }

    // Case 2: Update Permission Matrix { permissions: { [roleId]: string[] } }
    if (body.permissions) {
      let permSetting = await db.appSettings.findUnique({ where: { key: 'rbac_role_permissions' } })
      let rolePermissions = DEFAULT_ROLE_PERMISSIONS
      if (permSetting) {
        try { rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...JSON.parse(permSetting.value) } } catch {}
      }

      const mergedPermissions = withEssentialRolePermissions({ ...rolePermissions, ...body.permissions })

      await db.appSettings.upsert({
        where: { key: 'rbac_role_permissions' },
        update: { value: JSON.stringify(mergedPermissions) },
        create: { key: 'rbac_role_permissions', value: JSON.stringify(mergedPermissions), description: 'RBAC Permission Matrix' },
      })

      return NextResponse.json({ success: true, permissions: mergedPermissions })
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  } catch (error: any) {
    console.error('Update RBAC error:', error)
    return NextResponse.json({ error: 'Failed to update RBAC configuration' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const roleId = searchParams.get('id')
    if (!roleId) return NextResponse.json({ error: 'Role ID required' }, { status: 400 })

    let rolesSetting = await db.appSettings.findUnique({ where: { key: 'rbac_custom_roles' } })
    if (rolesSetting) {
      let roles: any[] = JSON.parse(rolesSetting.value)
      const target = roles.find(r => r.id === roleId)
      if (target?.isSystem) {
        return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 })
      }
      roles = roles.filter(r => r.id !== roleId)
      await db.appSettings.update({
        where: { key: 'rbac_custom_roles' },
        data: { value: JSON.stringify(roles) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete role error:', error)
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
  }
}
