'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, Download, LayoutGrid, List,
  Users, UserCheck, MapPin, Phone, CalendarDays, DollarSign, BarChart3,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useTenantCurrency } from '@/hooks/use-tenant-currency'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { exportToCSV } from '@/lib/csv-export'
import { useSortable } from '@/hooks/use-sort'
import { format } from 'date-fns'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

/* ------------------------------------------------------------------ */
/*  Helpers */
/* ------------------------------------------------------------------ */

const statusColor = (st: string) =>
  st === 'active'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'

const statusDot = (st: string) =>
  st === 'active'
    ? 'bg-emerald-500'
    : 'bg-gray-400'

const getInitials = (name: string) =>
  name
    ?.split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  area: '',
  addresses: [] as Array<{ label: string; address: string; city: string; area: string }>,
  notes: '',
  temporaryPassword: '',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Customers() {
  const currency = useTenantCurrency()
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const qc = useQueryClient()

  /* ---- Data fetching ---- */

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetch('/api/khobra-cleaning/customers').then((r) => r.json()),
  })

  const { data: allBookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => fetch('/api/khobra-cleaning/bookings').then((r) => r.json()),
  })

  const recentBookings = useMemo(() => {
    if (!selectedCustomer || !allBookings.length) return []
    return allBookings
      .filter((b: any) => b.customerId === selectedCustomer.id)
      .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 5)
  }, [selectedCustomer, allBookings])

  /* ---- Mutations ---- */

  const createMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/customers', {
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer added')
      setOpen(false)
      setForm(emptyForm)
    },
    onError: () => toast.error('Failed to add customer'),
  })

  const updateMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/customers', {
        method: 'PUT',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated')
      setOpen(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: () => toast.error('Failed to update customer'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/khobra-cleaning/customers?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deleted')
    },
    onError: () => toast.error('Failed to delete customer'),
  })

  /* ---- Handlers ---- */

  const handleEdit = (c: any, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const savedAddresses = Array.isArray(c.addresses) ? c.addresses : []
    const primaryAddress = savedAddresses[0]
    setForm({
      name: c.user?.name || '',
      email: c.user?.email || '',
      phone: c.phone || '',
      address: primaryAddress?.address || c.address || '',
      city: primaryAddress?.city || c.city || '',
      area: primaryAddress?.area || c.area || '',
      addresses: savedAddresses.slice(1).map((address: any) => ({ label: address.label || '', address: address.address || '', city: address.city || '', area: address.area || '' })),
      notes: c.notes || '',
      temporaryPassword: '',
    })
    setEditId(c.id)
    setOpen(true)
  }

  const handleViewDetail = (c: any) => {
    setSelectedCustomer(c)
    setDetailOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) return
    const addresses = [{ label: 'Primary', address: form.address, city: form.city, area: form.area }, ...form.addresses].filter(address => address.address.trim())
    if (editId) updateMut.mutate({ id: editId, ...form, addresses })
    else createMut.mutate({ ...form, addresses })
  }

  const handleExportCSV = () => {
    const exportData = filtered.map((c: any) => ({
      Name: c.user?.name || '',
      Phone: c.phone || '',
      City: c.city || '',
      Area: c.area || '',
      Status: c.status || '',
      'Created At': c.createdAt || '',
    }))
    exportToCSV(exportData, 'customers')
    toast.success('Exported')
  }

  /* ---- Derived state ---- */

  const filtered = items.filter((c: any) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.user?.name?.toLowerCase().includes(s) ||
      c.user?.email?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.area?.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s)
    )
  })

  const customerRevenue = useMemo(() => allBookings.reduce((totals: Record<string, number>, booking: any) => {
    totals[booking.customerId] = (totals[booking.customerId] || 0) + (booking.invoices || []).reduce((sum: number, invoice: any) => sum + (invoice.paidAmount || 0), 0)
    return totals
  }, {}), [allBookings])

  const listData = useMemo(() => filtered.map((c: any) => ({
    ...c,
    name: c.user?.name || '',
    bookings: c._count?.bookings || 0,
    revenue: customerRevenue[c.id] || 0,
  })), [filtered, customerRevenue])
  const { sorted: sortedList, SortableHeader } = useSortable<any>(listData, 'name')

  const stats = useMemo(() => {
    const active = items.filter((c: any) => c.status === 'active').length
    const cityMap: Record<string, number> = {}
    items.forEach((c: any) => {
      if (c.city) cityMap[c.city] = (cityMap[c.city] || 0) + 1
    })
    const topCity = Object.entries(cityMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    const totalBookings = allBookings.length
    const totalRevenue = allBookings.reduce((sum: number, booking: any) => sum + (booking.invoices || []).reduce((invoiceSum: number, invoice: any) => invoiceSum + (invoice.paidAmount || 0), 0), 0)
    const avgBookings =
      items.length > 0 ? (totalBookings / items.length).toFixed(1) : '0'
    return { total: items.length, active, topCity, avgBookings, totalBookings, totalRevenue }
  }, [items, allBookings])

  const areaDistribution = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((c: any) => {
      const a = c.area || c.city || 'Unknown'
      m[a] = (m[a] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [items])
  const maxArea = Math.max(...areaDistribution.map(([, c]) => c), 1)

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer base
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>

          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) {
                setForm(emptyForm)
                setEditId(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editId ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                </div>
                {!editId && <div className="grid gap-2"><Label>Temporary Password</Label><Input type="password" minLength={8} autoComplete="new-password" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} /></div>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Area</Label>
                  <Input
                    value={form.area}
                    onChange={(e) =>
                      setForm({ ...form, area: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Additional Addresses</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, addresses: [...form.addresses, { label: '', address: '', city: '', area: '' }] })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Address
                    </Button>
                  </div>
                  {form.addresses.map((savedAddress, index) => (
                    <div key={index} className="grid gap-2 rounded-md border p-3">
                      <div className="flex gap-2">
                        <Input value={savedAddress.label} onChange={event => setForm({ ...form, addresses: form.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, label: event.target.value } : address) })} placeholder="Label (e.g. Office)" />
                        <Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, addresses: form.addresses.filter((_, addressIndex) => addressIndex !== index) })} aria-label="Remove address"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={savedAddress.city} onChange={event => setForm({ ...form, addresses: form.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, city: event.target.value } : address) })} placeholder="City" />
                        <Input value={savedAddress.area} onChange={event => setForm({ ...form, addresses: form.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, area: event.target.value } : address) })} placeholder="Area" />
                      </div>
                      <Textarea value={savedAddress.address} onChange={event => setForm({ ...form, addresses: form.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, address: event.target.value } : address) })} placeholder="Address" />
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmit}
                  disabled={!form.name.trim()}
                >
                  {editId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Users, label: 'Total Customers', value: stats.total, color: 'bg-emerald-600', sub: `${stats.active} active` },
          { icon: UserCheck, label: 'Active', value: stats.active, color: 'bg-teal-600', sub: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total` },
          { icon: CalendarDays, label: 'Total Bookings', value: stats.totalBookings, color: 'bg-cyan-600', sub: `Avg ${stats.avgBookings}/customer` },
          { icon: DollarSign, label: 'Est. Revenue', value: `${currency} ${(stats.totalRevenue / 1000).toFixed(0)}K`, color: 'bg-emerald-500', sub: `Based on bookings` },
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

      {/* ---- Area Distribution ---- */}
      {areaDistribution.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Customer Area Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {areaDistribution.map(([area, count], i) => {
                  const pct = (count / maxArea) * 100
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

      {/* ---- Search, Filter & View Toggle ---- */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers.."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Grid view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>List view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ---- Content Area ---- */}
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
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        )
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-medium">No customersfound</p>
                  <p className="text-sm mt-1">
                    Try adjusting your search or add a new customer
                  </p>
                </div>
              ) : (
                filtered.map((c: any, idx: number) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                  >
                    <Card
                      className="border-0 shadow-sm hover:shadow-md transition-all duration-200 group h-full cursor-pointer relative overflow-hidden"
                      onClick={() => handleViewDetail(c)}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                      <CardContent className="p-5 pl-6 space-y-3">
                        {/* Top row: avatar + name + status */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-sm font-bold">
                                {getInitials(c.user?.name || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm truncate">
                                {c.user?.name}
                              </h3>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {c.phone || 'No phone'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`h-2 w-2 rounded-full ${statusDot(c.status)}`}
                            />
                            <Badge
                              className={`${statusColor(c.status)} text-[10px]`}
                            >
                              {c.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Location */}
                        {(c.city || c.area) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {[c.area, c.city].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Booking count badge */}
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1"
                          >
                            <CalendarDays className="h-3 w-3" />
                            {c._count?.bookings || 0} bookings
                          </Badge>
                          {c._count?.complaints > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-red-600 border-red-200"
                            >
                              {c._count.complaints} complaints
                            </Badge>
                          )}
                        </div>

                        {/* Actions — visible on hover */}
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => handleEdit(c, e)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this customer and
                                  all related data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMut.mutate(c.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            /* ---------- List / Table View ---------- */
            <motion.div
              key="list"
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
                          <TableHead className="text-xs font-semibold">
                            <SortableHeader col='name'>Customer</SortableHeader>
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden sm:table-cell">
                            Phone
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">
                            Location
                          </TableHead>
                          <TableHead className="text-xs font-semibold">
                            <SortableHeader col='bookings'>Bookings</SortableHeader>
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden sm:table-cell">
                            <SortableHeader col='revenue'>Revenue</SortableHeader>
                          </TableHead>
                          <TableHead className="text-xs font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedList.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center py-12"
                            >
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Users className="h-8 w-8 opacity-30" />
                                <span>No customersfound</span>
                                <span className="text-xs">
                                  Try adjusting your search or filter
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <AnimatePresence>
                            {sortedList.map((c: any, idx: number) => (
                              <motion.tr
                                key={c.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  delay: idx * 0.03,
                                }}
                                className={`${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/40`}
                                onClick={() => handleViewDetail(c)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-xs font-bold">
                                        {getInitials(c.user?.name || '')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <span className="font-medium text-sm block truncate">
                                        {c.user?.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground block truncate">
                                        {c.user?.email}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {c.phone || '-'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {[c.area, c.city]
                                    .filter(Boolean)
                                    .join(', ') || '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {c._count?.bookings || 0}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                  {currency} {c.revenue?.toLocaleString() || "0"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`h-2 w-2 rounded-full ${statusDot(c.status)}`}
                                    />
                                    <Badge
                                      className={`${statusColor(c.status)} text-xs`}
                                    >
                                      {c.status}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={(e) => handleEdit(c, e)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                    <AlertDialog>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-red-500 hover:text-red-700"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </AlertDialogTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Delete Customer
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently remove{' '}
                                            <strong>{c.user?.name}</strong>{' '}
                                            and all related data.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() =>
                                              deleteMut.mutate(c.id)
                                            }
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
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

      {/* ---- Customer Detail Dialog ---- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-lg font-bold">
                      {getInitials(selectedCustomer.user?.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-lg">
                      {selectedCustomer.user?.name}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`h-2 w-2 rounded-full ${statusDot(selectedCustomer.status)}`}
                      />
                      <Badge
                        className={`${statusColor(selectedCustomer.status)} text-xs`}
                      >
                        {selectedCustomer.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">
                      {selectedCustomer.phone || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium truncate">
                      {[selectedCustomer.area, selectedCustomer.city]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Total Bookings
                    </p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {selectedCustomer._count?.bookings || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium truncate">
                      {selectedCustomer.user?.email || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedCustomer.address && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm bg-muted/40 rounded-lg p-3">
                    {selectedCustomer.address}
                  </p>
                </div>
              )}

              {selectedCustomer.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted/40 rounded-lg p-3">
                    {selectedCustomer.notes}
                  </p>
                </div>
              )}

              <Separator />

              {/* Recent Bookings section */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Recent Bookings
                </p>
                {recentBookings.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recentBookings.map((b: any) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {b.bookingNo}
                          </span>
                          <span className="truncate">
                            {b.service?.name || 'Service'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {b.scheduledDate
                              ? format(new Date(b.scheduledDate), 'MMM d, yyyy')
                              : ''}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {b.status}
                          </Badge>
                          <span className="text-xs font-medium">
                            ₹{b.netAmount ?? 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No bookings on record
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


