'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, differenceInDays } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, AlertCircle, Plus, Clock, CheckCircle2, Timer,
  AlertTriangle, ChevronDown, ChevronUp, MessageSquare, Download,
  Upload, X, FileText, Paperclip, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { CreateComplaintSchema, UpdateComplaintSchema } from '@repo/core'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useSortable } from '@/hooks/use-sort'
import { exportToCSV } from '@/lib/csv-export'
import { useAppStore } from '@/store/app-store'
import { apiRequest } from '@/lib/api-client'

const priorityColors : Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const priorityBorderColors : Record<string, string> = {
  low: 'border-l-gray-400',
  medium: 'border-l-amber-400',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
}

const statusColors : Record<string, string> = {
  open: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-600',
}

const priorityIcons: Record<string, React.ReactNode> = {
  low: <ChevronDown className="h-3.5 w-3.5" />,
  medium: <AlertTriangle className="h-3.5 w-3.5" />,
  high: <AlertTriangle className="h-3.5 w-3.5" />,
  critical: <AlertCircle className="h-3.5 w-3.5" />,
}

const categories = ['Customer Issue', 'Service Quality', 'Staff Behavior', 'Billing', 'Scheduling', 'Other']
const priorities = ['low', 'medium', 'high', 'critical']

const statusFilterOptions = ['all', 'open', 'in_progress', 'resolved', 'closed']
const priorityFilterOptions = ['all', 'high', 'medium', 'low']

const priorityFilterActiveColors : Record<string, string> = {
  all: 'bg-emerald-600 hover:bg-emerald-700',
  high: 'bg-red-600 hover:bg-red-700',
  medium: 'bg-amber-600 hover:bg-amber-700',
  low: 'bg-emerald-600 hover:bg-emerald-700',
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}

function SLATimer({ createdAt, status }: { createdAt: string; status: string }) {
  const days = differenceInDays(new Date(), parseISO(createdAt))
  const isOpen = status === 'open' || status === 'in_progress'
  const breached = isOpen && days > 3

  if (!isOpen) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            breached
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
          }`}>
            <Timer className="h-3 w-3" />
            {days}d
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{breached ? 'SLA BREACHED! ' : ''}{days} days since opened (3-day SLA)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseAttachments(attachmentsStr: string | null | undefined): Array<{url: string; name: string; size: number; type: string}> {
  if (!attachmentsStr) return []
  try {
    const parsed = JSON.parse(attachmentsStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function Complaints() {
  const currentRole = useAppStore(state => state.currentRole)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [newStatus, setNewStatus] = useState('')
  const [newResolution, setNewResolution] = useState('')
  const [showTimeline, setShowTimeline] = useState(true)
  const qc = useQueryClient()

  // New complaint form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formBookingId, setFormBookingId] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPriority, setFormPriority] = useState('medium')
  const [formDescription, setFormDescription] = useState('')

  // Attachment state
  const [attachments, setAttachments] = useState<Array<{file: File; name: string; size: number; type: string}>>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/complaints'),
  })

  const { data: customers= [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/customers'),
    enabled: currentRole !== 'cleaner',
  })

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/bookings'),
  })

  const updateMut = useMutation({
    mutationFn: (d: any) =>
      apiRequest('/api/khobra-cleaning/complaints', {
        method: 'PUT',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Complaint updated successfully')
      setDetailOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update complaint'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/khobra-cleaning/complaints?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Complaint deleted')
      setDetailOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to delete complaint'),
  })

  const createMut = useMutation({
    mutationFn: async (d: any) => {
      // Upload attachments firs t
      const uploadResults: Array<{url: string; name: string; size: number; type: string}> = []
      for (const file of attachments) {
        try {
          const fd = new FormData()
          fd.append('file', file.file)
          const data = await apiRequest<{ url: string }>('/api/khobra-cleaning/upload', { method: 'POST', body: fd })
          if (data.url) {
            uploadResults.push({ url: data.url, name: file.name, size: file.size, type: file.type })
          }
        } catch {
          toast.error(`Failed to upload ${file.name}`)
        }
      }
      return apiRequest('/api/khobra-cleaning/complaints', {
        method: 'POST',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, attachments: JSON.stringify(uploadResults) }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Complaint filed successfully')
      setNewDialogOpen(false)
      resetForm()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to file complaint'),
  })

  const resetForm = () => {
    setFormCustomerId('')
    setFormBookingId('')
    setFormCategory('')
    setFormPriority('medium')
    setFormDescription('')
    setAttachments([])
    setIsDragging(false)
  }

  const handleUpdate = () => {
    const data: any = { id: selected.id }
    if (newStatus) data.status = newStatus
    if (newResolution) data.resolution = newResolution
    if (newStatus === 'resolved') data.resolvedAt = new Date().toISOString()
    const result = UpdateComplaintSchema.safeParse(data)
    if (result.success) updateMut.mutate(result.data)
  }

  const handleFileNew = () => {
    if (complaintContextError || !complaintValidation.success) return
    createMut.mutate({
      ...complaintValidation.data,
      customerId: formCustomerId || undefined,
      bookingId: formBookingId || undefined,
    })
  }

  const complaintInput = {
    customerId: formCustomerId || undefined,
    bookingId: formBookingId || undefined,
    category: formCategory || undefined,
    priority: formPriority,
    description: formDescription,
    status: 'open' as const,
  }
  const complaintValidation = CreateComplaintSchema.safeParse(complaintInput)
  const complaintContextError = currentRole === 'cleaner'
    ? (!formBookingId ? 'Booking is required' : '')
    : (!formCustomerId ? 'Customer is required' : '')
  const showComplaintValidation = Boolean(formCustomerId || formBookingId || formCategory || formDescription)

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`)
        continue
      }
      if (attachments.length >= 5) {
        toast.error('Maximum 5 attachments allowed')
        break
      }
      // Avoid duplicates
      if (attachments.some(a => a.name === file.name && a.size === file.size)) continue
      const fileEntry = { file, name: file.name, size: file.size, type: file.type }
      setAttachments(prev => [...prev, fileEntry])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const openDetail = (c: any) => {
    setSelected(c)
    setNewStatus(c.status)
    setNewResolution(c.resolution || '')
    setDetailOpen(true)
  }

  const filtered = useMemo(() => items.filter((c: any) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.complaintNo?.toLowerCase().includes(s) ||
      c.customer?.user?.name?.toLowerCase().includes(s) ||
      c.category?.toLowerCase().includes(s) ||
      c.description?.toLowerCase().includes(s)
    )
  }), [items, statusFilter, priorityFilter, search])

  const { sorted: sortedComplaints, SortableHeader } = useSortable<any>(filtered, 'complaintNo')

  const handleExport = () => {
    const exportData = filtered.map((c: any) => ({
      Description: c.description || '',
      Category: c.category || '',
      Priority: c.priority || '',
      Status: c.status || '',
      'Created At': c.createdAt || '',
    }))
    exportToCSV(exportData, 'complaints')
    toast.success('Exported')
  }

  // Summary metrics
  const openCount = items.filter((c: any) => c.status === 'open').length
  const inProgressCount = items.filter((c: any) => c.status === 'in_progress').length
  const resolvedCount = items.filter((c: any) => c.status === 'resolved' || c.status === 'closed').length

  const avgResolutionDays = (() => {
    const resolved = items.filter((c: any) => c.resolvedAt && c.createdAt)
    if (resolved.length === 0) return 0
    const total = resolved.reduce((sum: number, c: any) => {
      return sum + differenceInDays(parseISO(c.resolvedAt), parseISO(c.createdAt))
    }, 0)
    return Math.round((total / resolved.length) * 10) / 10
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex items-center justify-between flex-wrap gap-4" {...fadeUp}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints</h1>
          <p className="text-sm text-muted-foreground">Track and resolve customer issues</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setNewDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            File New Complaint
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: AlertCircle, label: 'Open', value: openCount, color: openCount > 0 ? 'bg-red-500' : 'bg-emerald-600', sub: openCount > 0 ? 'needs attention' : 'all clear', pulse: openCount > 0 },
          { icon: Timer, label: 'In Progress', value: inProgressCount, color: 'bg-amber-500', sub: `${inProgressCount} active` },
          { icon: CheckCircle2, label: 'Resolved', value: resolvedCount, color: 'bg-emerald-600', sub: `${items.length > 0 ? Math.round((resolvedCount / items.length) * 100) : 0}% resolved` },
          { icon: Clock, label: 'Avg Resolution', value: `${avgResolutionDays}d`, color: 'bg-teal-600', sub: '3-day SLA target' },
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
                  <div className={`p-2 rounded-xl ${card.color} ${card.pulse ? 'animate-pulse' : ''} transition-transform hover:scale-110`}>
                    <card.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Status Filter Badges */}
      <motion.div className="space-y-2" {...fadeUp}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Status</span>
          {statusFilterOptions.map(s => (
            <motion.div key={s} layout>
              <Button
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                className={`text-xs h-7 capitalize ${statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </Button>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Priority</span>
          {priorityFilterOptions.map(p => (
            <motion.div key={p} layout>
              <Button
                variant={priorityFilter === p ? 'default' : 'outline'}
                size="sm"
                className={`text-xs h-7 capitalize ${priorityFilter === p ? `${priorityFilterActiveColors [p]} text-white` : ''}`}
                onClick={() => setPriorityFilter(p)}
              >
                {p === 'all' ? 'All' : p}
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div className="flex flex-col sm:flex-row gap-3" {...fadeUp}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search complaints by ticket, customer, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Complaints Table */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold"><SortableHeader col={'complaintNo'}>Ticket</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold">Customer</TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={'priority'}>Priority</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Description</TableHead>
                      <TableHead className="text-xs font-semibold">SLA</TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={'status'}>Status</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell"><SortableHeader col={'createdAt'}>Created</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {sortedComplaints.map((c: any, index: number) => {
                        const complaintAttachments = parseAttachments(c.attachments)
                        return (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: index * 0.03 }}
                            className={`border-l-4 ${priorityBorderColors [c.priority] || 'border-l-gray-300'} hover:bg-muted/40 transition-colors ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                          >
                            <TableCell className="font-mono text-xs font-medium">{c.complaintNo}</TableCell>
                            <TableCell className="font-medium">{c.customer?.user?.name || '-'}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline" className="text-xs">{c.category || '-'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`gap-1 ${priorityColors [c.priority] || ''}`}>
                                {priorityIcons[c.priority]}
                                {c.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm max-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{c.description}</span>
                                {complaintAttachments.length > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                                          <Paperclip className="h-3.5 w-3.5" />
                                          <span className="text-[10px] font-medium">{complaintAttachments.length}</span>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{complaintAttachments.length} attachment{complaintAttachments.length !== 1 ? 's' : ''}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <SLATimer createdAt={c.createdAt} status={c.status} />
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors [c.status] || ''}>
                                {c.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {format(parseISO(c.createdAt), 'MMM dd')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => openDetail(c)}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                Manage
                              </Button>
                            </TableCell>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                    {sortedComplaints.length === 0 && !isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                          <p className="text-sm text-muted-foreground">No complaints found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* File New Complaint Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={(open) => { setNewDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentRole === 'cleaner' ? 'Report Customer Issue' : 'File New Complaint'}</DialogTitle>
            <DialogDescription>{currentRole === 'cleaner' ? 'Report an issue regarding the customer on one of your assigned bookings.' : 'Submit a new customer complaint for tracking and resolution.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {currentRole !== 'cleaner' && <div className="grid gap-2">
              <Label>Customer <span className="text-red-500">*</span></Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust: any) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.user?.name || cust.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            <div className="grid gap-2">
              <Label>Booking {currentRole === 'cleaner' ? <span className="text-red-500">*</span> : '(optional)'}</Label>
              <Select value={formBookingId} onValueChange={value => { setFormBookingId(value); if (currentRole === 'cleaner') setFormCustomerId(bookings.find((booking: any) => booking.id === value)?.customerId || '') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking..." />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bookingNo} — {b.customer?.user?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map(p => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Describe the complaint in detail..."
                rows={4}
              />
            </div>

            {/* Attachments Drop Zone */}
            <div className="grid gap-2">
              <Label>Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={e => handleFilesSelected(e.target.files)}
              />
              <div
                className={`border-dashed border-2 border-muted-foreground/25 rounded-lg p-3 hover:border-emerald-500/50 transition-colors cursor-pointer ${
                  isDragging ? 'border-emerald-500 bg-emerald-500/5' : attachments.length > 0 ? 'border-emerald-500/40 hover:border-emerald-500/60' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFilesSelected(e.dataTransfer.files) }}
              >
                {attachments.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-2">
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Add attachments</p>
                    <p className="text-xs text-muted-foreground/60">Images or PDF, max 5MB each</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {att.type?.startsWith('image/') ? (
                            <FileText className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{att.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                        </div>
                        <button
                          type="button"
                          className="p-1 rounded-full hover:bg-muted transition-colors shrink-0"
                          onClick={(e) => { e.stopPropagation(); removeAttachment(idx) }}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    {attachments.length < 5 && (
                      <button
                        type="button"
                        className="w-full text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 py-1"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                      >
                        + Add more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            {(createMut.error || (showComplaintValidation && (complaintContextError || !complaintValidation.success))) && (
              <p className="text-sm text-destructive sm:mr-auto" role="alert">
                {createMut.error instanceof Error
                  ? createMut.error.message
                  : complaintContextError || (!complaintValidation.success ? complaintValidation.error.issues[0]?.message : '')}
              </p>
            )}
            <Button variant="outline" onClick={() => { setNewDialogOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleFileNew}
              disabled={Boolean(complaintContextError) || !complaintValidation.success || createMut.isPending}
            >
              {createMut.isPending ? 'Filing...' : 'File Complaint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Complaint Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Complaint {selected?.complaintNo}</DialogTitle>
            <DialogDescription>Update status, priority, and resolution details.</DialogDescription>
          </DialogHeader>
          {selected && (() => {
            const selectedAttachments = parseAttachments(selected.attachments)
            return (
              <div className="space-y-4 py-2">
                {/* Complaint Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{' '}
                    <span className="font-medium">{selected.customer?.user?.name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge className={priorityColors [selected.priority]}>
                      {priorityIcons[selected.priority]}
                      {selected.priority}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>{' '}
                    <span className="font-medium">{selected.category || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Booking:</span>{' '}
                    <span className="font-mono">{selected.booking?.bookingNo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{' '}
                    <span className="font-medium">{format(parseISO(selected.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SLA:</span>{' '}
                    <span className="font-medium">
                      {differenceInDays(new Date(), parseISO(selected.createdAt))} days since opened
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{selected.description}</p>
                </div>

                {/* Attachments Section */}
                {selectedAttachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium">Attachments ({selectedAttachments.length})</p>
                    </div>
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2"
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: {},
                        show: { transition: { staggerChildren: 0.06 } },
                      }}
                    >
                      {selectedAttachments.map((att, idx) => (
                        <motion.a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variants={{
                            hidden: { opacity: 0, scale: 0.9 },
                            show: { opacity: 1, scale: 1 },
                          }}
                          className="block rounded-lg border border-border/50 overflow-hidden hover:border-emerald-500/50 transition-colors group"
                        >
                          {att.type?.startsWith('image/') ? (
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-full h-24 object-cover rounded-t-lg group-hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted/50 flex items-center justify-center rounded-t-lg">
                              <FileText className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] font-medium truncate">{att.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                          </div>
                        </motion.a>
                      ))}
                    </motion.div>
                  </div>
                )}

                {/* Resolution */}
                {selected.resolution && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Resolution</p>
                    <p className="text-sm">{selected.resolution}</p>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                    onClick={() => setShowTimeline(!showTimeline)}
                  >
                    {showTimeline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Status Timeline
                  </button>
                  <AnimatePresence>
                    {showTimeline && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 pl-4 border-l-2 border-muted space-y-3">
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                            <div>
                              <p className="text-xs font-medium">Complaint Created</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(selected.createdAt), 'MMM dd, yyyy \'at\' hh:mm a')}
                              </p>
                            </div>
                          </div>
                          {selected.status !== 'open' && (
                            <div className="relative">
                              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-background" />
                              <div>
                                <p className="text-xs font-medium">Status Changed to In Progress</p>
                                <p className="text-xs text-muted-foreground">
                                  {selected.updatedAt && format(parseISO(selected.updatedAt), 'MMM dd, yyyy \'at\' hh:mm a')}
                                </p>
                              </div>
                            </div>
                          )}
                          {(selected.status === 'resolved' || selected.status === 'closed') && selected.resolvedAt && (
                            <div className="relative">
                              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                              <div>
                                <p className="text-xs font-medium">Complaint Resolved</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(selected.resolvedAt), 'MMM dd, yyyy \'at\' hh:mm a')}
                                </p>
                                {selected.resolution && (
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{selected.resolution}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Separator />

                {/* Admin-only resolution controls */}
                {currentRole === 'admin' && <>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Resolution Notes</Label>
                  <Textarea
                    value={newResolution}
                    onChange={e => setNewResolution(e.target.value)}
                    placeholder="How was this resolved?"
                    rows={3}
                  />
                </div>
                </>}
              </div>
            )
          })()}
          {currentRole === 'admin' ? <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Complaint</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete complaint {selected?.complaintNo}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => selected && deleteMut.mutate(selected.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex items-center gap-2">
              {updateMut.error && <p className="text-sm text-destructive" role="alert">{updateMut.error instanceof Error ? updateMut.error.message : 'Failed to update complaint'}</p>}
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleUpdate}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter> : <DialogFooter><Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button></DialogFooter>}
        </DialogContent>
      </Dialog>
    </div>
  )
}


