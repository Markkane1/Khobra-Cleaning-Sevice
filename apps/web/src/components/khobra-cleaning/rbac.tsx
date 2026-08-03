'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Plus, Search, Check, X, Users, Lock, Key, Settings,
  Shield, Layers, LayoutDashboard, Sparkles, Building2, Trash2, Save, CheckCircle2, Pencil, Sliders,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const MODULE_PAGES = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Main operations overview and KPI analytics' },
  { id: 'services', label: 'Services Catalog', desc: 'Manage cleaning services, rates, and duration' },
  { id: 'customers', label: 'Customers CRM', desc: 'Customer profiles, history, and records' },
  { id: 'employees', label: 'Cleaners & Workforce', desc: 'Cleaner profiles, skills, and payroll information' },
  { id: 'bookings', label: 'Bookings & Schedule', desc: 'Job scheduling, assignments, and calendar' },
  { id: 'finance', label: 'Finance & Invoices', desc: 'Invoices, payments, and revenue reporting' },
  { id: 'dispatch', label: 'Dispatch & Drivers', desc: 'Vehicle trips, driver assignments, and mileage' },
  { id: 'inventory', label: 'Inventory & Supplies', desc: 'Stock levels, materials, and vendors' },
  { id: 'reports', label: 'Analytics & Reports', desc: 'Performance reports and financial statements' },
  { id: 'complaints', label: 'Complaints & Support', desc: 'SLA tracking and issue resolution' },
  { id: 'attendance', label: 'Attendance Tracking', desc: 'Clock-in/out and leave management' },
  { id: 'payroll', label: 'Payroll Processing', desc: 'Monthly salary calculation and payouts' },
  { id: 'branches', label: 'Branches Management', desc: 'Office locations and branch setup' },
  { id: 'settings', label: 'Settings & Security', desc: 'Tenant settings and platform configuration' },
  { id: 'rbac', label: 'Role & Permission Control', desc: 'Dynamic RBAC matrix and role assignments' },
]

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

export function RBACManagement() {
  const [tab, setTab] = useState<'matrix' | 'users' | 'roles'>('matrix')
  const [searchUser, setSearchUser] = useState('')
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [rolePermManagerOpen, setRolePermManagerOpen] = useState(false)
  const [newPermOpen, setNewPermOpen] = useState(false)

  // Forms
  const [newRoleForm, setNewRoleForm] = useState({ name: '', description: '' })
  const [editRoleForm, setEditRoleForm] = useState({ id: '', name: '', description: '' })
  const [newPermForm, setNewPermForm] = useState({ id: '', label: '', desc: '' })
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<any | null>(null)
  const [selectedPermToAdd, setSelectedPermToAdd] = useState('')

  const [customPages, setCustomPages] = useState<{ id: string; label: string; desc: string }[]>([])
  const [localPermissions, setLocalPermissions] = useState<Record<string, string[]> | null>(null)
  const qc = useQueryClient()

  // Fetch RBAC data
  const { data: rbacData, isLoading } = useQuery({
    queryKey: ['rbac'],
    queryFn: () => fetch('/api/khobra-cleaning/rbac').then(r => r.json()),
  })

  const roles: any[] = rbacData?.roles || []
  const permissions: Record<string, string[]> = localPermissions || rbacData?.permissions || {}
  const users: any[] = rbacData?.users || []

  // Create or Update Role mutation
  const createRoleMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/rbac', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac'] })
      toast.success('Role saved successfully')
      setNewRoleOpen(false)
      setEditRoleOpen(false)
      setNewRoleForm({ name: '', description: '' })
    },
    onError: () => toast.error('Failed to save role'),
  })

  // Update permission matrix mutation
  const saveMatrixMut = useMutation({
    mutationFn: (perms: Record<string, string[]>) => fetch('/api/khobra-cleaning/rbac', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: perms }) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac'] })
      toast.success('Role permissions updated successfully')
    },
    onError: () => toast.error('Failed to save permissions'),
  })

  // Assign user role mutation
  const assignRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => fetch('/api/khobra-cleaning/rbac', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac'] })
      toast.success('User role updated')
    },
    onError: () => toast.error('Failed to update user role'),
  })

  // Delete role mutation
  const deleteRoleMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/rbac?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error)
        return
      }
      qc.invalidateQueries({ queryKey: ['rbac'] })
      toast.success('Custom role deleted')
    },
    onError: () => toast.error('Failed to delete role'),
  })

  const togglePermission = (roleId: string, pageId: string) => {
    const current = permissions[roleId] || []
    const updated = current.includes(pageId)
      ? current.filter(p => p !== pageId)
      : [...current, pageId]
    setLocalPermissions({ ...permissions, [roleId]: updated })
  }

  const handleAddPermissionToRole = (roleId: string, pageId: string) => {
    if (!pageId) return
    const current = permissions[roleId] || []
    if (!current.includes(pageId)) {
      const updated = [...current, pageId]
      const newMatrix = { ...permissions, [roleId]: updated }
      setLocalPermissions(newMatrix)
      saveMatrixMut.mutate(newMatrix)
      toast.success(`Granted permission '${pageId}' to role`)
    }
  }

  const handleRemovePermissionFromRole = (roleId: string, pageId: string) => {
    const current = permissions[roleId] || []
    const updated = current.filter(p => p !== pageId)
    const newMatrix = { ...permissions, [roleId]: updated }
    setLocalPermissions(newMatrix)
    saveMatrixMut.mutate(newMatrix)
    toast.success(`Removed permission '${pageId}' from role`)
  }

  const handleSaveMatrix = () => {
    saveMatrixMut.mutate(permissions)
  }

  const allPages = useMemo(() => {
    return [...MODULE_PAGES, ...customPages]
  }, [customPages])

  const filteredUsers = useMemo(() => {
    if (!searchUser) return users
    const s = searchUser.toLowerCase()
    return users.filter((u: any) => u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.role?.toLowerCase().includes(s))
  }, [users, searchUser])

  const handleAddCustomPermission = () => {
    if (!newPermForm.label.trim()) return
    const id = newPermForm.id.trim() || newPermForm.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
    setCustomPages(prev => [...prev, { id, label: newPermForm.label, desc: newPermForm.desc || 'Custom permission action' }])
    toast.success(`Custom permission '${newPermForm.label}' added to matrix`)
    setNewPermOpen(false)
    setNewPermForm({ id: '', label: '', desc: '' })
  }

  const handleOpenEditRole = (role: any) => {
    setEditRoleForm({ id: role.id, name: role.name, description: role.description || '' })
    setEditRoleOpen(true)
  }

  const handleOpenRolePermManager = (role: any) => {
    setSelectedRoleForPerms(role)
    setRolePermManagerOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Control & Role Management (RBAC)</h1>
          <p className="text-sm text-muted-foreground">Define custom roles, assign fine-grained page permissions, and reassign user roles</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Add Custom Permission Modal */}
          <Dialog open={newPermOpen} onOpenChange={setNewPermOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400">
                <Sparkles className="h-4 w-4 mr-2" />Add Custom Permission Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Dynamic Custom Permission Action</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Permission Label</Label>
                  <Input value={newPermForm.label} onChange={e => setNewPermForm({ ...newPermForm, label: e.target.value })} placeholder="e.g. Export Financial Statements" />
                </div>
                <div className="grid gap-2">
                  <Label>Permission Key / ID (Optional)</Label>
                  <Input value={newPermForm.id} onChange={e => setNewPermForm({ ...newPermForm, id: e.target.value })} placeholder="e.g. export_finance_reports" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={newPermForm.desc} onChange={e => setNewPermForm({ ...newPermForm, desc: e.target.value })} placeholder="e.g. Allows exporting full revenue CSVs" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewPermOpen(false)}>Cancel</Button>
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={handleAddCustomPermission} disabled={!newPermForm.label.trim()}>
                  Add Permission Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New Custom Role Modal */}
          <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />New Custom Role
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Custom Role</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Role Name *</Label>
                  <Input value={newRoleForm.name} onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })} placeholder="e.g. Field Operations Manager" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={newRoleForm.description} onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })} placeholder="e.g. Manages dispatch, cleaners, and daily schedule" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewRoleOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createRoleMut.mutate(newRoleForm)} disabled={!newRoleForm.name.trim()}>
                  Create Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Role Modal */}
          <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Role Details</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Role Name</Label>
                  <Input value={editRoleForm.name} onChange={e => setEditRoleForm({ ...editRoleForm, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={editRoleForm.description} onChange={e => setEditRoleForm({ ...editRoleForm, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditRoleOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createRoleMut.mutate(editRoleForm)}>
                  Save Role Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Role Specific Fine-Grained Permission Manager Dialog */}
          <Dialog open={rolePermManagerOpen} onOpenChange={setRolePermManagerOpen}>
            <DialogContent className="sm:max-w-xl">
              {selectedRoleForPerms && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-emerald-600" />
                      Manage Permissions for Role: <span className="text-emerald-700">{selectedRoleForPerms.name}</span>
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-3">
                    {/* Add Specific Permission to Role */}
                    <div className="p-3 rounded-lg bg-muted/40 border space-y-2">
                      <Label className="text-xs font-semibold">Add / Grant Specific Permission to {selectedRoleForPerms.name}</Label>
                      <div className="flex gap-2">
                        <Select value={selectedPermToAdd} onValueChange={setSelectedPermToAdd}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select permission page to grant..." /></SelectTrigger>
                          <SelectContent>
                            {allPages
                              .filter(p => !(permissions[selectedRoleForPerms.id] || []).includes(p.id))
                              .map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.label} ({p.id})</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs gap-1"
                          onClick={() => {
                            handleAddPermissionToRole(selectedRoleForPerms.id, selectedPermToAdd)
                            setSelectedPermToAdd('')
                          }}
                          disabled={!selectedPermToAdd}
                        >
                          <Plus className="h-3.5 w-3.5" />Grant
                        </Button>
                      </div>
                    </div>

                    {/* Granted Permissions List */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Currently Granted Permissions ({ (permissions[selectedRoleForPerms.id] || []).length })</Label>
                      <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                        {(permissions[selectedRoleForPerms.id] || []).map((permId) => {
                          const pageObj = allPages.find(p => p.id === permId)
                          return (
                            <div key={permId} className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/40 text-xs transition-colors">
                              <div>
                                <p className="font-semibold text-foreground">{pageObj?.label || permId}</p>
                                <p className="text-[11px] text-muted-foreground">{pageObj?.desc || 'Module permission'}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => handleRemovePermissionFromRole(selectedRoleForPerms.id, permId)}
                                disabled={selectedRoleForPerms.id === 'admin' && permId === 'rbac'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        })}

                        {(permissions[selectedRoleForPerms.id] || []).length === 0 && (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            No permissions currently granted to this role.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRolePermManagerOpen(false)}>Close</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleSaveMatrix} disabled={saveMatrixMut.isPending} className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
            <Save className="h-4 w-4 mr-2" />Save Permission Matrix
          </Button>
        </div>
      </motion.div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="matrix" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Permission Matrix</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            <span>Role Directory ({roles.length})</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span>User Role Assignments ({users.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Permission Matrix */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dynamic Page-Level Permission Matrix</CardTitle>
              <CardDescription>Click checkboxes to grant or revoke specific page access for any role, or manage role permissions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="min-w-[220px]">Module / Page</TableHead>
                        {roles.map((r: any) => (
                          <TableHead key={r.id} className="text-center min-w-[140px]">
                            <div className="flex flex-col items-center gap-1 py-1">
                              <span className="font-semibold text-xs text-foreground cursor-pointer hover:underline" onClick={() => handleOpenRolePermManager(r)}>
                                {r.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {r.isSystem ? 'System' : 'Custom'}
                                </Badge>

                                <Button size="icon" variant="ghost" className="h-5 w-5 text-emerald-600" onClick={() => handleOpenRolePermManager(r)} title="Manage Role Permissions">
                                  <Sliders className="h-3 w-3" />
                                </Button>

                                {!r.isSystem && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 text-red-500 hover:text-red-700">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
                                        <AlertDialogDescription>Delete role "{r.name}"? This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteRoleMut.mutate(r.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allPages.map((page) => (
                        <TableRow key={page.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sm font-semibold">{page.label}</p>
                              <p className="text-[11px] text-muted-foreground">{page.desc}</p>
                            </div>
                          </TableCell>
                          {roles.map((role: any) => {
                            const isGranted = (permissions[role.id] || []).includes(page.id)
                            return (
                              <TableCell key={role.id} className="text-center">
                                <Checkbox
                                  checked={isGranted}
                                  onCheckedChange={() => togglePermission(role.id, page.id)}
                                  disabled={role.id === 'admin' && page.id === 'rbac'} // Admin always has RBAC
                                  className="h-5 w-5 border-emerald-500 data-[state=checked]:bg-emerald-600"
                                />
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Roles Directory & Detailed CRUD Management */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r: any) => {
              const rolePerms = permissions[r.id] || []
              return (
                <Card key={r.id} className="border-0 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={r.isSystem ? 'default' : 'secondary'} className={r.isSystem ? 'bg-emerald-600' : ''}>
                        {r.isSystem ? 'Built-in System Role' : 'Custom Tenant Role'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleOpenEditRole(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!r.isSystem && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteRoleMut.mutate(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg font-bold pt-1">{r.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">{r.description || 'System access role definition'}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Granted Permissions ({rolePerms.length}):</span>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                        {rolePerms.map((pId: string) => (
                          <Badge key={pId} variant="outline" className="text-[9px] bg-muted/40">
                            {pId}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5 border-emerald-300 text-emerald-700"
                      onClick={() => handleOpenRolePermManager(r)}
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      Configure Role Permissions
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Tab 3: User Role Assignments */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex-row items-center justify-between pb-3 flex-wrap gap-4">
              <div>
                <CardTitle className="text-base">User Role Assignments</CardTitle>
                <CardDescription>Reassign roles and access privileges to registered platform users</CardDescription>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search user name or email..."
                  value={searchUser}
                  onChange={e => setSearchUser(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>User Name</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead className="text-right">Reassign Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-xs">{u.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {u.role || 'customer'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={u.role || 'customer'}
                          onValueChange={(newRole) => assignRoleMut.mutate({ userId: u.id, role: newRole })}
                        >
                          <SelectTrigger className="h-8 text-xs w-40 ml-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {roles.map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
