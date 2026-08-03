'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays, startOfDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, UserCheck, Users, TrendingUp, CalendarDays,
  LogIn, LogOut, Search, Download, Hourglass, AlertTriangle, Plus, Trash2, Check, X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSortable } from '@/hooks/use-sort'
import { exportToCSV, csvDate } from '@/lib/csv-export'

const attStatusColors : Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  leave: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'half-day': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const attStatusDot: Record<string, string> = {
  present: 'bg-emerald-500',
  absent: 'bg-red-500',
  leave: 'bg-amber-500',
  'half-day': 'bg-orange-500',
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
}

export function Attendance() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [clockEmployeeId, setClockEmployeeId] = useState('')
  const [search, setSearch] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', startDate: '', endDate: '', type: 'Annual', days: 1, reason: '' })
  const qc = useQueryClient()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => fetch('/api/khobra-cleaning/attendance').then(r => r.json()),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetch('/api/khobra-cleaning/employees').then(r => r.json()),
  })

  const { data: leaveRecords = [] } = useQuery({
    queryKey: ['leaveRecords'],
    queryFn: () => fetch('/api/khobra-cleaning/leave').then(r => r.json()),
  })

  const createLeaveMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaveRecords'] }); toast.success('Leave request submitted'); setLeaveOpen(false); setLeaveForm({ employeeId: '', startDate: '', endDate: '', type: 'Annual', days: 1, reason: '' }) },
    onError: () => toast.error('Failed to submit leave request'),
  })

  const clockMut = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/khobra-cleaning/attendance', {
        method: data.id ? 'PUT' : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Attendance record updated') },
    onError: () => toast.error('Failed to update attendance record'),
  })

  const deleteAttendanceMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/attendance?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Attendance record deleted') },
    onError: () => toast.error('Failed to delete attendance record'),
  })

  const updateLeaveMut = useMutation({
    mutationFn: (data: any) => fetch('/api/khobra-cleaning/leave', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaveRecords'] }); toast.success('Leave status updated') },
    onError: () => toast.error('Failed to update leave status'),
  })

  const deleteLeaveMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/leave?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaveRecords'] }); toast.success('Leave request deleted') },
    onError: () => toast.error('Failed to delete leave request'),
  })

  const handleClockIn = () => {
    if (!clockEmployeeId) { toast.error('Please select a cleaner first'); return }
    clockMut.mutate({ employeeId: clockEmployeeId, date: format(new Date(), 'yyyy-MM-dd'), clockIn: new Date().toISOString(), status: 'present' })
  }

  const handleClockOut = () => {
    if (!clockEmployeeId) { toast.error('Please select a cleaner first'); return }
    const record = records.find((r: any) =>
      r.employeeId === clockEmployeeId &&
      format(parseISO(r.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') &&
      r.clockIn && !r.clockOut,
    )
    if (!record) { toast.error('Clock in before clocking out'); return }
    clockMut.mutate({ id: record.id, clockOut: new Date().toISOString(), status: 'present' })
  }

  const filteredRecords = useMemo(() => {
    let result = dateFilter ? records.filter((r: any) => format(parseISO(r.date), 'yyyy-MM-dd') === dateFilter) : records
    if (search) {
      const s = search.toLowerCase()
      result = result.filter((r: any) => (r.employee?.user?.name || '').toLowerCase().includes(s) || (r.employee?.employeeCode || '').toLowerCase().includes(s))
    }
    return result
  }, [records, dateFilter, search])

  const recordsForSort = useMemo(() => filteredRecords.map((r: any) => ({ ...r, employeeName: r.employee?.user?.name || '' })), [filteredRecords])
  const { sorted: sortedRecords, SortableHeader } = useSortable<any>(recordsForSort, 'employeeName')

  const todayRecords = records.filter((r: any) => format(parseISO(r.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
  const presentToday = todayRecords.filter((r: any) => r.status === 'present').length
  const absentToday = todayRecords.filter((r: any) => r.status === 'absent').length
  const onLeaveToday = todayRecords.filter((r: any) => r.status === 'leave').length
  const totalHours = todayRecords.reduce((s: number, r: any) => {
    if (r.clockIn && r.clockOut) { s += (parseISO(r.clockOut).getTime() - parseISO(r.clockIn).getTime()) / 3600000 }
    return s
  }, 0)

  const allPresent = records.filter((r: any) => r.status === 'present').length
  const attendanceRate = records.length > 0 ? Math.round((allPresent / records.length) * 100) : 0

  const chartData = useMemo(() => {
    const days: Array<{ day: string; present: number; absent: number }> = []
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i)
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayRecords = records.filter((r: any) => format(parseISO(r.date), 'yyyy-MM-dd') === dayStr)
      days.push({
        day: format(day, 'EEE'),
        present: dayRecords.filter((r: any) => r.status === 'present').length,
        absent: dayRecords.filter((r: any) => r.status === 'absent').length,
      })
    }
    return days
  }, [records])

  const handleExport = () => {
    exportToCSV(filteredRecords.map((r: any) => ({
      employee: r.employee?.user?.name || '-',
      code: r.employee?.employeeCode || '-',
      date: csvDate(r.date),
      clockIn: r.clockIn ? format(parseISO(r.clockIn), 'hh:mm a') : '-',
      clockOut: r.clockOut ? format(parseISO(r.clockOut), 'hh:mm a') : '-',
      hours : r.clockIn && r.clockOut ? ((parseISO(r.clockOut).getTime() - parseISO(r.clockIn).getTime()) / 3600000).toFixed(1) : '-',
      status: r.status,
    })), 'attendance-records')
    toast.success('Attendance exported')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex items-center justify-between flex-wrap gap-4" {...fadeUp}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">Cleaner attendance and time tracking</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={leaveOpen} onOpenChange={(v) => { setLeaveOpen(v); if (!v) setLeaveForm({ employeeId: '', startDate: '', endDate: '', type: 'Annual', days: 1, reason: '' }) }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs"><Plus className="h-3.5 w-3.5 mr-1.5" />Request Leave</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Submit Leave Request</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Cleaner</Label>
                  <Select value={leaveForm.employeeId} onValueChange={v => setLeaveForm({ ...leaveForm, employeeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select cleaner..." /></SelectTrigger>
                    <SelectContent>
                      {employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.user?.name || emp.employeeCode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Leave Type</Label>
                    <Select value={leaveForm.type} onValueChange={v => setLeaveForm({ ...leaveForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Annual">Annual Leave</SelectItem>
                        <SelectItem value="Sick">Sick Leave</SelectItem>
                        <SelectItem value="Casual">Casual Leave</SelectItem>
                        <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Number of Days</Label><Input type="number" value={leaveForm.days} onChange={e => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Reason (optional)</Label><Textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createLeaveMut.mutate(leaveForm)} disabled={!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" className="text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { icon: UserCheck, label: 'Present Today', value: presentToday, color: 'bg-emerald-600', sub: `of ${todayRecords.length} records` },
          { icon: AlertTriangle, label: 'Absent Today', value: absentToday, color: absentToday > 0 ? 'bg-red-500' : 'bg-emerald-600', sub: absentToday > 0 ? 'needs attention' : 'all present', pulse: absentToday > 0 },
          { icon: Clock, label: 'Total Records', value: records.length, color: 'bg-teal-600', sub: 'all time entries' },
          { icon: Hourglass, label: 'Hours Today', value: `${totalHours.toFixed(1)}h`, color: 'bg-cyan-600', sub: `${presentToday} staff clocked` },
          { icon: TrendingUp, label: 'Attendance Rate', value: `${attendanceRate}%`, color: attendanceRate >= 80 ? 'bg-emerald-600' : 'bg-amber-500', sub: `${allPresent}/${records.length} present` },
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

      {/* Clock In/Out + Date Filter */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground">Filter by Date</Label>
                <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="mt-1" />
              </div>
              {dateFilter && (
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDateFilter('')}>Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Clock className="h-4 w-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs font-medium text-muted-foreground">Clock In / Out</Label>
                <Select value={clockEmployeeId} onValueChange={setClockEmployeeId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select cleaner..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.user?.name || emp.employeeCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 mt-5">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={handleClockIn} disabled={clockMut.isPending}>
                  <LogIn className="h-4 w-4 mr-1.5" />Clock In
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={handleClockOut} disabled={clockMut.isPending}>
                  <LogOut className="h-4 w-4 mr-1.5" />Clock Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Chart */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Last 7 Days Overview</CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Present</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />Absent</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                  <Bar dataKey="present" name="Present" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="absent" name="Absent" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Table */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold">
                {dateFilter ? `Records for ${format(parseISO(dateFilter), 'MMM dd, yyyy')}` : 'All Attendance Records'}
                <Badge variant="secondary" className="ml-2 text-xs">{filteredRecords.length}</Badge>
              </CardTitle>
              <div className="relative max-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search cleaner..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {isLoading ? (
              <div className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold"><SortableHeader col={"employeeName"}>Cleaner</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={"date"}>Date</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">Clock In</TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">Clock Out</TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Hours </TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={"status"}>Status</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                    {sortedRecords.map((r: any, index: number) => {
                      let hours = '-'
                      let hoursNum = 0
                      if (r.clockIn && r.clockOut) {
                        hoursNum = (parseISO(r.clockOut).getTime() - parseISO(r.clockIn).getTime()) / 3600000
                        hours = `${hoursNum.toFixed(1)}h`
                      }
                      const name = r.employee?.user?.name || '-'
                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className={`hover:bg-muted/40 transition-colors ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{getInitials(name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{name}</p>
                                <p className="text-xs text-muted-foreground">{r.employee?.employeeCode || ''}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{format(parseISO(r.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {r.clockIn ? (
                              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{format(parseISO(r.clockIn), 'hh:mm a')}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {r.clockOut ? (
                              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />{format(parseISO(r.clockOut), 'hh:mm a')}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${hoursNum >= 8 ? 'text-emerald-600 dark:text-emerald-400' : hoursNum > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{hours }</span>
                              {hoursNum > 0 && <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${hoursNum >= 8 ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${Math.min((hoursNum / 10) * 100, 100)}%` }} /></div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`gap-1.5 ${attStatusColors [r.status] || ''}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${attStatusDot[r.status] || ''}`} />
                              {r.status.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
                                  <AlertDialogDescription>Delete attendance entry for {name}? This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteAttendanceMut.mutate(r.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                    </AnimatePresence>
                    {sortedRecords.length === 0 && !isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                          <p className="text-sm text-muted-foreground">No attendance records found</p>
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
    </div>
  )
}


