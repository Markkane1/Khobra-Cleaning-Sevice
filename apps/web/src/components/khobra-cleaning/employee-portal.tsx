'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Clock, CheckCircle2, CalendarDays, TrendingUp, UserCheck, ChevronRight, Sparkles, MapPin, AlertTriangle, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'

const attStatusColors : Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  leave: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'half-day': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export function EmployeePortal() {
  const setView = useAppStore(s => s.setView)

  const { data: attendance = [], isLoading: aLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => fetch('/api/khobra-cleaning/attendance').then(r => r.json()),
  })

  const { data: bookings = [], isLoading: bLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => fetch('/api/khobra-cleaning/bookings').then(r => r.json()),
  })

  const loading = aLoading || bLoading

  const demoEmployeeId = bookings[0]?.assignments?.[0]?.employeeId
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const myAttendance = attendance.filter((r: any) => format(parseISO(r.date), 'yyyy-MM-dd') === todayStr)
  const todayStatus = myAttendance.length > 0 ? myAttendance[0].status : 'not_clocked'

  const todayAssignments = bookings
    .filter((b: any) => b.assignments?.some((a: any) => a.employeeId === demoEmployeeId))
    .sort((a: any, b: any) => {
      const tA = a.startTime || '00:00'
      const tB = b.startTime || '00:00'
      return tA.localeCompare(tB)
    })

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    const dayRecords = attendance.filter((r: any) => format(parseISO(r.date), 'yyyy-MM-dd') === d)
    const present = dayRecords.some((r: any) => r.status === 'present')
    return { day: format(subDays(new Date(), 6 - i), 'EEE'), short: format(subDays(new Date(), 6 - i), 'ddd'), present, absent: !present, records: dayRecords.length }
  })

  const presentDays = last7.filter(d => d.present).length
  const completedAssignments = bookings.filter((b: any) =>
    b.status === 'completed' && b.assignments?.some((a: any) => a.employeeId === demoEmployeeId)
  ).length

  const kpis = [
    { icon: Clock, label: 'Today Status', value: todayStatus === 'not_clocked' ? 'Not Clocked' : todayStatus.charAt(0).toUpperCase() + todayStatus.slice(1), color: todayStatus === 'present' ? 'bg-emerald-600' : todayStatus === 'leave' ? 'bg-amber-500' : 'bg-gray-500' },
    { icon: CalendarDays, label: 'My Assignments', value: todayAssignments.length, color: 'bg-teal-600', sub: 'for today' },
    { icon: CheckCircle2, label: 'Completed', value: completedAssignments, color: 'bg-cyan-600', sub: 'total' },
    { icon: UserCheck, label: 'This Week', value: `${presentDays}/7`, color: presentDays >= 5 ? 'bg-emerald-600' : 'bg-orange-500', sub: 'days present' },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 overflow-hidden">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Cleaner Portal</h2>
              <p className="text-sm text-muted-foreground">Your daily work overview and schedule.</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 dark:bg-white/5 rounded-2xl px-6 py-4 shrink-0">
              <UserCheck className="h-12 w-12 text-teal-600 opacity-80" strokeWidth={1.2} />
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-700">{todayAssignments.length}</p>
                <p className="text-[10px] text-muted-foreground">Today&apos;s Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow relative">
              <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${kpi.color}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                    {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
                  </div>
                  <div className={`p-2 rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setView('bookings')}>
                  All Bookings <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No assignments for today</p>
                ) : todayAssignments.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors ">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.service?.name || 'Service'}</p>
                      <p className="text-xs text-muted-foreground">{b.startTime || '--'} · {b.duration || 0}h</p>
                    </div>
                    <Badge className={b.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}>
                      {b.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Attendance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {last7.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium">{d.short}</span>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      d.present ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {d.present ? '✓' : '–'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Present</span>
                  <span className="font-bold text-emerald-600">{presentDays} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-bold">{Math.round((presentDays / 7) * 100)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}


