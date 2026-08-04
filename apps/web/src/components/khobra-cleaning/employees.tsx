'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, Download, LayoutGrid, List,
  Users, UserCheck, MapPin, Phone, BarChart3, Eye, Wallet, Mail, Briefcase, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { exportToCSV } from '@/lib/csv-export'
import { useSortable } from '@/hooks/use-sort'
import { useTenantCurrency } from '@/hooks/use-tenant-currency'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

/* ------------------------------------------------------------------ */
/*  Colour helpers */
/* ------------------------------------------------------------------ */

const empStatusColor = (st: string) => {
  switch (st) {
    case 'active':    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'on_leave':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    default:          return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const empStatusDot = (st: string) => {
  switch (st) {
    case 'active':    return 'bg-emerald-500'
    case 'on_leave': return 'bg-amber-500'
    default:          return 'bg-gray-400'
  }
}

const avatarGradients = [
  'from-emerald-400 to-teal-500',
  'from-teal-400 to-cyan-500',
  'from-cyan-400 to-emerald-500',
  'from-emerald-500 to-green-500',
  'from-teal-500 to-emerald-600',
]

const skillPillColors = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
]

const barColors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-amber-500', 'bg-emerald-400']

const getInitials = (n: string) =>
  n?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '??'

const getGradient = (n: string) => {
  let h = 0
  for (let i = 0; i < (n || '').length; i++) h = n.charCodeAt(i) + ((h << 5) - h)
  return avatarGradients[Math.abs(h) % avatarGradients.length]
}

const emptyForm = {
  name: '', email: '', phone: '', address: '',
  city: '', area: '', skills: '', baseSalary: 0, status: 'active', temporaryPassword: '',
}

/* ------------------------------------------------------------------ */
/*  Delete button (reusable to keep JSX tidy)                         */
/* ------------------------------------------------------------------ */

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Cleaner</AlertDialogTitle>
          <AlertDialogDescription>
            Remove this cleaner? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Employee avatar helper                                             */
/* ------------------------------------------------------------------ */

function EmpAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls =
    size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  const txtCls =
    size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-xs'

  return (
    <Avatar className={`${cls} bg-gradient-to-br ${getGradient(name)}`}>
      <AvatarFallback className={`bg-transparent text-white ${txtCls} font-bold`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function Employees() {
  const currency = useTenantCurrency()
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const qc = useQueryClient()

  /* ---------- data fetching ----------------------------------------- */

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetch('/api/khobra-cleaning/employees').then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  })

  const createMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/employees', {
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Cleaner added')
      setOpen(false)
      setForm(emptyForm)
    },
    onError: () => toast.error('Failed to add cleaner'),
  })

  const updateMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/employees', {
        method: 'PUT',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Cleaner updated')
      setOpen(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: () => toast.error('Failed to update cleaner'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/khobra-cleaning/employees?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Cleaner removed')
    },
    onError: () => toast.error('Failed to remove cleaner'),
  })

  /* ---------- handlers --------------------------------------------- */

  const handleEdit = (e: any) => {
    setForm({
      name: e.user?.name || '',
      email: e.user?.email || '',
      phone: e.phone || '',
      address: e.address || '',
      city: e.city || '',
      area: e.area || '',
      skills: e.skills || '',
      baseSalary: e.baseSalary || 0,
      status: e.status || 'active',
      temporaryPassword: '',
    })
    setEditId(e.id)
    setOpen(true)
  }

  const handleViewDetail = (e: any) => {
    setSelectedEmployee(e)
    setDetailOpen(true)
  }

  const handleSubmit = () => {
    if (editId) updateMut.mutate({ id: editId, ...form })
    else createMut.mutate(form)
  }

  /* ---------- derived ---------------------------------------------- */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { total: items.length, active: 0, inactive: 0 }
    items.forEach((e: any) => {
      if (e.status === 'active') counts.active++
      else if (e.status === 'inactive') counts.inactive++
    })
    return counts
  }, [items])

  const filtered = useMemo(
    () =>
      items.filter((e: any) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false
        if (!search) return true
        const s = search.toLowerCase()
        return (
          e.user?.name?.toLowerCase().includes(s) ||
          e.employeeCode?.toLowerCase().includes(s) ||
          e.area?.toLowerCase().includes(s) ||
          e.city?.toLowerCase().includes(s) ||
          e.skills?.toLowerCase().includes(s)
        )
      }),
    [items, search, statusFilter],
  )

  const tableData = useMemo(() => filtered.map((e: any) => ({
    ...e,
    name: e.user?.name || '',
    baseSalary: e.baseSalary || 0,
  })), [filtered])
  const { sorted: sortedTable, SortableHeader } = useSortable<any>(tableData, 'name')

  const stats = useMemo(() => {
    const active = items.filter((e: any) => e.status === 'active').length
    const onLeave = items.filter((e: any) => e.status === 'on_leave').length
    const totalPayroll = items.reduce(
      (sum: number, e: any) => sum + (e.baseSalary || 0),
      0,
    )
    return { total: items.length, active, onLeave, totalPayroll }
  }, [items])

  const skillsDistribution = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((e: any) => {
      if (e.skills)
        e.skills.split(',').forEach((s: string) => {
          const t = s.trim()
          if (t) m[t] = (m[t] || 0) + 1
        })
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [items])

  const maxSkillCount = skillsDistribution.length > 0 ? skillsDistribution[0][1] : 1

  const areaDistribution = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((e: any) => {
      const a = e.area || e.city || 'Unknown'
      m[a] = (m[a] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [items])
  const maxAreaCount = Math.max(...areaDistribution.map(([, c]) => c), 1)

  const roleDistribution = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((e: any) => {
      const r = e.designation || 'Unassigned'
      m[r] = (m[r] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [items])
  const maxRoleCount = roleDistribution.length > 0 ? roleDistribution[0][1] : 1

  const handleExportCSV = () => {
    const data = filtered.map((e: any) => ({
      'Cleaner Code': e.employeeCode || '',
      Name: e.user?.name || '',
      Department: e.department || '',
      Designation: e.designation || '',
      Phone: e.phone || '',
      Status: e.status || '',
      'Join Date': e.joinDate || '',
    }))
    exportToCSV(data, 'employees')
    toast.success('Exported')
  }

  /* ---------- render ------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cleaners</h1>
          <p className="text-sm text-muted-foreground">Workforce management and skills tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>

          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) { setForm(emptyForm); setEditId(null) }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />Add Cleaner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? 'Edit Cleaner' : 'Add New Cleaner'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                {!editId && <div className="grid gap-2"><Label>Temporary Password</Label><Input type="password" minLength={8} autoComplete="new-password" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} /></div>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Base Salary ({currency})</Label>
                    <Input type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Area</Label>
                    <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Skills (comma-separated)</Label>
                  <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="deep_cleaning, bathroom, kitchen" />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={!form.name}>
                  {editId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* ─── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Users, label: 'Total Staff', value: stats.total, color: 'bg-emerald-600', sub: stats.active > 0 ? `${stats.active} active` : 'No staff yet' },
          { icon: UserCheck, label: 'Active', value: stats.active, color: 'bg-teal-600', sub: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total` },
          { icon: Users, label: 'On Leave', value: stats.onLeave, color: 'bg-amber-500', sub: stats.onLeave > 0 ? 'Needs coverage' : 'All present' },
          { icon: Wallet, label: 'Monthly Payroll', value: `${currency} ${(stats.totalPayroll / 1000).toFixed(0)}K`, color: 'bg-cyan-600', sub: 'Base salary sum' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.color}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight tabular-nums">{card.value}</p>
                    {card.sub && <p className="text-[11px] text-muted-foreground">{card.sub}</p>}
                  </div>
                  <div className={`p-2 rounded-xl ${card.color} transition-transform hover:scale-110`}>
                    <card.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── Area Distribution ────────────────────────────────── */}
      {areaDistribution.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Cleaner Area Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {areaDistribution.map(([area, count], i) => {
                  const pct = (count / maxAreaCount) * 100
                  const gradients = [
                    'bg-gradient-to-r from-emerald-400 to-emerald-500',
                    'bg-gradient-to-r from-teal-400 to-teal-500',
                    'bg-gradient-to-r from-cyan-400 to-cyan-500',
                    'bg-gradient-to-r from-emerald-300 to-teal-400',
                    'bg-gradient-to-r from-teal-300 to-cyan-400',
                    'bg-gradient-to-r from-cyan-300 to-emerald-400',
                  ]
                  return (
                    <div key={area} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">{String(area)}</span>
                      <div className="flex-1 h-5 rounded-full bg-muted/60 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${gradients[i % gradients.length]}`}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.3 + i * 0.06 }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Role Distribution ──────────────────────────────────── */}
      {roleDistribution.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.22 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Role Distribution (Top 5)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {roleDistribution.map(([role, count], i) => {
                  const pct = Math.round((count / maxRoleCount) * 100)
                  const gradients = [
                    'bg-gradient-to-r from-emerald-400 to-emerald-500',
                    'bg-gradient-to-r from-teal-400 to-teal-500',
                    'bg-gradient-to-r from-cyan-400 to-cyan-500',
                    'bg-gradient-to-r from-emerald-300 to-teal-400',
                    'bg-gradient-to-r from-teal-300 to-cyan-400',
                  ]
                  return (
                    <div key={role} className="flex items-center gap-3">
                      <span className="text-xs font-medium min-w-[100px] sm:min-w-[140px] truncate">{String(role)}</span>
                      <div className="flex-1 h-5 bg-muted/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 }}
                          className={`h-full rounded-full ${gradients[i % gradients.length]}`}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground min-w-[24px] text-right">{Number(count)}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Skills Distribution ────────────────────────────────── */}
      {skillsDistribution.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Skills Distribution (Top 5)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {skillsDistribution.map(([skill, count], i) => {
                  const pct = Math.round((count / maxSkillCount) * 100)
                  return (
                    <div key={skill} className="flex items-center gap-3">
                      <span className="text-xs font-medium min-w-[100px] sm:min-w-[140px] truncate">{String(skill)}</span>
                      <div className="flex-1 h-5 bg-muted/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 }}
                          className={`h-full rounded-full ${barColors [i % barColors.length]}`}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground min-w-[24px] text-right">{Number(count)}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Status Filter Badges ───────────────────────────────── */}
      <motion.div layout className="flex flex-wrap gap-1.5">
        {(['all', 'active', 'inactive'] as const).map(s => {
          const count = s === 'all' ? statusCounts.total : statusCounts[s]
          return (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm"
              className={`text-xs h-7 ${statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ({count})
            </Button>
          )
        })}
      </motion.div>

      {/* ─── Search & View Toggle ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cleaners" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Grid view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>List view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ─── Loading Skeleton ────────────────────────────────────── */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        )
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            /* ─── Grid Card View ──────────────────────────────────── */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.length === 0 ? (
                <div className="col-span-full py-12 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No cleaners found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search</p>
                </div>
              ) : (
                filtered.map((e: any, idx: number) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                  >
                    <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group h-full relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                      <CardContent className="p-5 pl-6 space-y-3">
                        {/* avatar + name + actions */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <EmpAvatar name={e.user?.name || ''} size="md" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm truncate">{e.user?.name}</h3>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${empStatusDot(e.status)}`} />
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{e.employeeCode}</p>
                            </div>
                          </div>

                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetail(e)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <DeleteButton onConfirm={() => deleteMut.mutate(e.id)} />
                          </div>
                        </div>

                        {/* location */}
                        {(e.city || e.area) && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[e.area, e.city].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* salary + status badge */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                            {currency} {(e.baseSalary || 0).toLocaleString()}
                          </span>
                          <Badge className={`${empStatusColor(e.status)} text-[10px]`}>
                            {e.status?.replace('_', ' ')}
                          </Badge>
                        </div>

                        {/* skill pills */}
                        {e.skills && (
                          <div className="flex flex-wrap gap-1">
                            {e.skills.split(',').slice(0, 4).map((s: string, si: number) => (
                              <span
                                key={si}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${skillPillColors [si % skillPillColors.length]}`}
                              >
                                {s.trim()}
                              </span>
                            ))}
                            {e.skills.split(',').length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{e.skills.split(',').length - 4}</span>
                            )}
                          </div>
                        )}

                        {/* assignments */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          <span>{e._count?.assignments || 0} assignments</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{e.ratingCount ? `${e.averageRating.toFixed(1)} (${e.ratingCount})` : 'No ratings'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            /* ─── Table View ───────────────────────────────────────── */
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="max-h-[520px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold"><SortableHeader col={'name' as any}>Cleaner</SortableHeader></TableHead>
                          <TableHead className="text-xs font-semibold hidden sm:table-cell">Skills</TableHead>
                          <TableHead className="text-xs font-semibold hidden lg:table-cell">Area</TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell"><SortableHeader col={'baseSalary' as any}>Salary</SortableHeader></TableHead>
                          <TableHead className="text-xs font-semibold">Assignments</TableHead>
                          <TableHead className="text-xs font-semibold"><SortableHeader col={'status' as any}>Status</SortableHeader></TableHead>
                          <TableHead className="text-xs font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTable.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Users className="h-8 w-8 text-muted-foreground/40" />
                                <span>No cleaners found</span>
                                <span className="text-xs">Try adjusting your search</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <AnimatePresence>
                            {sortedTable.map((e: any, idx: number) => (
                              <motion.tr
                                key={e.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.03 }}
                                className={`${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors border-b border-border/40`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <EmpAvatar name={e.user?.name || ''} />
                                    <div>
                                      <p className="font-medium text-sm">{e.user?.name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{e.employeeCode}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <div className="flex flex-wrap gap-1">
                                    {e.skills?.split(',').slice(0, 3).map((s: string, si: number) => (
                                      <span
                                        key={si}
                                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${skillPillColors [si % skillPillColors.length]}`}
                                      >
                                        {s.trim()}
                                      </span>
                                    ))}
                                    {(e.skills?.split(',').length ?? 0) > 3 && (
                                      <span className="text-[10px] text-muted-foreground">+{e.skills.split(',').length - 3}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm">
                                  {e.area}{e.area && e.city ? ', ' : ''}{e.city}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm font-semibold">
                                  {currency} {(e.baseSalary || 0).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{e._count?.assignments || 0}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`${empStatusColor(e.status)} text-xs`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${empStatusDot(e.status)} mr-1.5 inline-block`} />
                                    {e.status?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetail(e)}>
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View details</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                    <DeleteButton onConfirm={() => deleteMut.mutate(e.id)} />
                                  </div>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ─── Employee Detail Dialog ──────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <EmpAvatar name={selectedEmployee.user?.name || ''} size="lg" />
                  <div>
                    <DialogTitle className="text-lg">{selectedEmployee.user?.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-muted-foreground">{selectedEmployee.employeeCode}</span>
                      <Badge className={`${empStatusColor(selectedEmployee.status)} text-xs`}>
                        {selectedEmployee.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{selectedEmployee.user?.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{selectedEmployee.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">
                      {[selectedEmployee.area, selectedEmployee.city].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Base Salary</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {currency} {(selectedEmployee.baseSalary || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Rating</p>
                    <p className="text-sm font-medium">{selectedEmployee.ratingCount ? `${selectedEmployee.averageRating.toFixed(1)} ★ (${selectedEmployee.ratingCount} ratings)` : 'No ratings yet'}</p>
                  </div>
                </div>
              </div>

              {selectedEmployee.address && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm bg-muted/40 rounded-lg p-3">{selectedEmployee.address}</p>
                </div>
              )}

              {selectedEmployee.skills && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEmployee.skills.split(',').map((s: string, i: number) => (
                      <span
                        key={i}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${skillPillColors [i % skillPillColors.length]}`}
                      >
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  <Briefcase className="h-3.5 w-3.5 inline mr-1.5" />
                  Assignments
                </p>
                {selectedEmployee._count?.assignments > 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    {selectedEmployee._count.assignments} assignment(s) on record
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No assignments yet</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


