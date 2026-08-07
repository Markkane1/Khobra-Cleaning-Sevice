'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bell, Send, Plus, Trash2, CheckCircle2, AlertTriangle, Info, AlertCircle, Sparkles, Filter, Search, Users, ShieldAlert, Check, RefreshCw, Mail, User, Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { exportToCSV } from '@/lib/csv-export'

export type NotificationItem = {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'urgent' | string
  userId?: string | null
  read: boolean
  createdAt: string
}

export function NotificationManagement() {
  const [openCompose, setOpenCompose] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Notification Compose Form
  const [composeForm, setComposeForm] = useState({
    title: '',
    message: '',
    type: 'info',
    targetAudience: 'all', // 'all', 'customer', 'employee', 'driver', 'user'
    selectedUserId: '',
  })

  const qc = useQueryClient()

  // Fetch Notifications
  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', 'audit'],
    queryFn: () => fetch('/api/khobra-cleaning/notifications?channel=in_app').then(r => r.json()),
  })

  // Fetch Users for Target User Selection
  const { data: rbacData } = useQuery({
    queryKey: ['rbac'],
    queryFn: () => fetch('/api/khobra-cleaning/rbac').then(r => r.json()),
  })
  const users = rbacData?.users || []

  // Create & Dispatch Notification Mutation
  const createNotifMut = useMutation({
    mutationFn: async (d: any) => {
      const response = await fetch('/api/khobra-cleaning/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to dispatch notification')
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification broadcast dispatched successfully!')
      setOpenCompose(false)
      setComposeForm({ title: '', message: '', type: 'info', targetAudience: 'all', selectedUserId: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Mark All Read Mutation
  const markAllReadMut = useMutation({
    mutationFn: () =>
      fetch('/api/khobra-cleaning/notifications?channel=in_app', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
  })

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeForm.title || !composeForm.message) {
      toast.error('Title and message are required')
      return
    }
    if (composeForm.targetAudience === 'user' && !composeForm.selectedUserId) {
      toast.error('Select a recipient user')
      return
    }

    const payload: any = {
      title: composeForm.title,
      message: composeForm.message,
      type: composeForm.type,
      userId: composeForm.targetAudience === 'user' ? composeForm.selectedUserId : null,
    }

    createNotifMut.mutate(payload)
  }

  const filtered = useMemo(() => {
    if (!Array.isArray(notifications)) return []
    return notifications.filter(n => {
      const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.message.toLowerCase().includes(search.toLowerCase())
      const matchType = typeFilter === 'all' || n.type === typeFilter
      return matchSearch && matchType
    })
  }, [notifications, search, typeFilter])

  const stats = useMemo(() => {
    const total = notifications.length
    const unread = notifications.filter(n => !n.read).length
    const urgent = notifications.filter(n => n.type === 'warning' || n.type === 'error' || n.type === 'urgent').length
    return { total, unread, urgent }
  }, [notifications])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
      case 'urgent':
        return <Badge className="bg-amber-500 text-white gap-1"><AlertTriangle className="h-3 w-3" />Urgent</Badge>
      case 'error':
        return <Badge className="bg-red-600 text-white gap-1"><AlertCircle className="h-3 w-3" />Alert</Badge>
      case 'success':
        return <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Success</Badge>
      default:
        return <Badge variant="outline" className="text-cyan-700 border-cyan-300 bg-cyan-50 gap-1"><Info className="h-3 w-3" />Info</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-sm text-muted-foreground">Broadcast system alerts, targeted role announcements, and customer updates</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>

          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-emerald-300 text-emerald-700" onClick={() => markAllReadMut.mutate()}>
            <Check className="h-3.5 w-3.5" />Mark All Read
          </Button>

          {/* Broadcast Modal */}
          <Dialog open={openCompose} onOpenChange={setOpenCompose}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Send className="h-4 w-4" />Broadcast Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Send System Broadcast Notification</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSendNotification} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Notification Title *</Label>
                  <Input
                    value={composeForm.title}
                    onChange={e => setComposeForm({ ...composeForm, title: e.target.value })}
                    placeholder="e.g. Scheduled Service Maintenance"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Detailed Message Body *</Label>
                  <Textarea
                    value={composeForm.message}
                    onChange={e => setComposeForm({ ...composeForm, message: e.target.value })}
                    placeholder="Provide clear details and instructions for users..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Notification Type</Label>
                    <Select value={composeForm.type} onValueChange={v => setComposeForm({ ...composeForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info / General</SelectItem>
                        <SelectItem value="success">Success / Update</SelectItem>
                        <SelectItem value="warning">Warning / Alert</SelectItem>
                        <SelectItem value="urgent">Urgent Announcement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Target Audience</Label>
                    <Select value={composeForm.targetAudience} onValueChange={v => setComposeForm({ ...composeForm, targetAudience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users (Broadcast)</SelectItem>
                        <SelectItem value="user">Specific User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {composeForm.targetAudience === 'user' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Recipient User</Label>
                    <Select value={composeForm.selectedUserId} onValueChange={v => setComposeForm({ ...composeForm, selectedUserId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose user..." /></SelectTrigger>
                      <SelectContent>
                        {users.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpenCompose(false)}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={createNotifMut.isPending}>
                    <Send className="h-3.5 w-3.5" />Send Now
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Dispatched</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unread Alerts</p>
              <p className="text-xl font-bold">{stats.unread}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Urgent Warnings</p>
              <p className="text-xl font-bold">{stats.urgent}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Sent Notifications Audit Log</CardTitle>
            <CardDescription>History of all system broadcasts and targeted messages</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Type</TableHead>
                <TableHead>Notification Title</TableHead>
                <TableHead>Message Content</TableHead>
                <TableHead>Target Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((n) => (
                <TableRow key={n.id} className="hover:bg-muted/30">
                  <TableCell>{getTypeBadge(n.type)}</TableCell>
                  <TableCell className="font-semibold text-foreground text-xs">{n.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">{n.message}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {n.userId ? 'Direct User' : 'Broadcast (All)'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.read ? 'secondary' : 'default'} className={!n.read ? 'bg-emerald-600' : ''}>
                      {n.read ? 'Read' : 'Unread'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No notifications match the filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
