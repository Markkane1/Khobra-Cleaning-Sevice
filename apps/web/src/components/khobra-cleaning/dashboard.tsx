'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, startOfDay, addDays, startOfWeek, endOfWeek } from 'date-fns'
import {
  CalendarDays, UserPlus, CreditCard, MessageSquarePlus, MessageSquareWarning, Sparkles,
  CalendarCheck, Users, DollarSign, Clock, AlertTriangle, PackageX, UserCheck,
  Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight, MapPin, Activity,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useAppStore } from '@/store/app-store'

/* ------------------------------------------------------------------ */
/*  Animation Variants                                                 */
/* ------------------------------------------------------------------ */

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' as const },
  }),
}

/* ------------------------------------------------------------------ */
/*  Color maps                                                         */
/* ------------------------------------------------------------------ */

const statusBadgeColors : Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  on_the_way: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const statusTimelineDot: Record<string, string> = {
  completed: 'bg-emerald-500',
  pending: 'bg-yellow-500',
  confirmed: 'bg-teal-500',
  on_the_way: 'bg-cyan-500',
  in_progress: 'bg-orange-500',
  cancelled: 'bg-red-500',
}

const statusDonutColors : Record<string, string> = {
  completed: '#10b981',
  confirmed: '#14b8a6',
  on_the_way: '#06b6d4',
  in_progress: '#f97316',
  pending: '#f59e0b',
  cancelled: '#ef4444',
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({ icon: Icon, label, value, sub, color, gradient, index, trend, fraction, pulse }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  color: string; gradient: string; index: number; trend?: { value: string; up: boolean };
  fraction?: string; pulse?: boolean
}) {
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <Card className="hover:shadow-md transition-shadow border-0 shadow-sm relative overflow-hidden rounded-xl">
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">{value}</p>
                {trend && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                    trend.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  }`}>
                    {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {trend.value}
                  </span>
                )}
                {fraction && (
                  <span className="text-xs font-medium text-muted-foreground">{fraction}</span>
                )}
              </div>
              {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
            </div>
            <div className={`p-2 sm:p-3 rounded-xl ${color} ${pulse ? 'animate-pulse' : ''} shrink-0 transition-transform hover:scale-110`}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Circular Gauge (completion rate)                                   */
/* ------------------------------------------------------------------ */

function CompletionGauge({ percentage, label }: { percentage: number; label: string }) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedPct / 100) * circumference

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedPct(percentage), 200)
    return () => clearTimeout(timeout)
  }, [percentage])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[140px] h-[140px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke="#10b981" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{animatedPct}%</span>
          <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */

const tooltipStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 13,
}

function AedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="font-medium text-xs mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color || '#10b981' }}>
          {entry.name}: AED {(entry.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Component                                           */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/khobra-cleaning/dashboard').then(r => r.json()),
    refetchInterval: 30000,
  })

  const { data: activityData = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/khobra-cleaning/activity').then(r => r.json()),
    refetchInterval: 20000,
  })
  const setView = useAppStore((s) => s.setView)

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])
  const timeStr = format(now, 'HH:mm')

  const quickActions = [
    { label: 'New Booking', icon: CalendarDays, view: 'bookings' as const },
    { label: 'Add Customer', icon: UserPlus, view: 'customers' as const },
    { label: 'Record Payment', icon: CreditCard, view: 'finance' as const },
    { label: 'File Complaint', icon: MessageSquarePlus, view: 'complaints' as const },
    { label: 'Add Cleaner', icon: UserPlus, view: 'employees' as const },
  ]

  /* ── Loading skeleton ── */
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  const { stats, todaysBookings, revenueByDay, unassignedBookings, recentBookings } = data

  /* ── Revenue by day data ── */
  const revData = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(startOfDay(new Date()), -6 + i), 'MMM dd')
    const dayRev = revenueByDay
      ?.filter((r: { issuedAt: string }) => format(parseISO(r.issuedAt), 'MMM dd') === d)
      .reduce((sum: number, r: { totalAmount: number }) => sum + (r.totalAmount || 0), 0) || 0
    return { day: d, revenue: Math.round(dayRev) }
  })

  /* ── Booking status distribution for donut ── */
  const confirmedBookings = Math.max(0, stats.totalBookings - (stats.completedBookings + stats.pendingBookings + stats.cancelledBookings + stats.inProgressBookings))
  const statusDonutData = [
    { name: 'Pending', value: stats.pendingBookings || 0 },
    { name: 'Confirmed', value: confirmedBookings },
    { name: 'In Progress', value: stats.inProgressBookings || 0 },
    { name: 'Completed', value: stats.completedBookings || 0 },
    { name: 'Cancelled', value: stats.cancelledBookings || 0 },
  ].filter(d => d.value > 0)

  /* ── Completion rate ── */
  const completionRate = stats.totalBookings > 0
    ? Math.round((stats.completedBookings / stats.totalBookings) * 100)
    : 0

  /* ── Summary stat strip ── */
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekBookings = (recentBookings || []).filter((b: any) => {
    const bd = parseISO(b.scheduledDate)
    return bd >= weekStart && bd <= weekEnd
  }).length
  const weekRevenue = revenueByDay
    ?.filter((r: { issuedAt: string }) => {
      const rd = parseISO(r.issuedAt)
      return rd >= weekStart && rd <= weekEnd
    })
    .reduce((s: number, r: { totalAmount: number }) => s + (r.totalAmount || 0), 0) || 0
  const avgPerBooking = stats.totalBookings > 0
    ? Math.round(stats.totalRevenue / stats.totalBookings)
    : 0

  /* ── Next booking today ── */
  const nextBooking = (todaysBookings || [])
    .filter((b: any) => b.status !== 'completed' && b.status !== 'cancelled' && b.startTime)
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))[0]
  const nextBookingTime = nextBooking?.startTime || null
  let timeUntilNext = ''
  if (nextBookingTime) {
    const [h, m] = nextBookingTime.split(':').map(Number)
    const bookingDate = new Date()
    bookingDate.setHours (h, m, 0, 0)
    const diffMs = bookingDate.getTime() - now.getTime()
    if (diffMs > 0) {
      const diffMin = Math.round(diffMs / 60000)
      if (diffMin >= 60) {
        timeUntilNext = `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
      } else {
        timeUntilNext = `${diffMin}m`
      }
    } else {
      timeUntilNext = 'Now'
    }
  }

  /* ── KPI definitions ── */
  const kpis = [
    { icon: Briefcase, label: 'Total Bookings', value: stats.totalBookings, color: 'bg-emerald-600', gradient: 'from-emerald-400 to-teal-500', sub: `${stats.todayBookings} today` },
    { icon: CalendarCheck, label: "Today's Schedule", value: stats.todayBookings, color: 'bg-teal-600', gradient: 'from-teal-400 to-cyan-500' },
    { icon: Clock, label: 'Active Jobs', value: stats.inProgressBookings, color: 'bg-orange-500', gradient: 'from-orange-400 to-amber-500' },
    { icon: DollarSign, label: 'Total Revenue', value: `AED ${stats.totalRevenue.toLocaleString()}`, color: 'bg-emerald-700', gradient: 'from-emerald-500 to-green-500', sub: `${stats.paidInvoices}/${stats.totalInvoices} invoices paid`, trend: { value: '12%', up: true } },
    { icon: DollarSign, label: 'Pending Payments', value: `AED ${Math.round(stats.pendingPaymentAmount || 0).toLocaleString()}`, color: 'bg-amber-600', gradient: 'from-amber-400 to-orange-500' },
    { icon: Users, label: 'Customers', value: stats.totalCustomers, color: 'bg-teal-700', gradient: 'from-teal-500 to-cyan-600' },
    { icon: UserCheck, label: 'Active Cleaners', value: stats.activeEmployees, color: 'bg-emerald-500', gradient: 'from-emerald-400 to-teal-600', sub: `${stats.onLeaveEmployees} on leave`, fraction: `${stats.activeEmployees}/${stats.activeEmployees + stats.onLeaveEmployees}` },
    { icon: PackageX, label: 'Low Stock Alerts', value: stats.lowStockItems, color: stats.lowStockItems > 0 ? 'bg-red-500' : 'bg-emerald-600', gradient: stats.lowStockItems > 0 ? 'from-red-400 to-orange-500' : 'from-emerald-400 to-teal-500', pulse: stats.lowStockItems > 0 },
  ]

  /* ── Activity timeline (enhanced with multi-source data) ── */
  const activityIconMap: Record<string, any> = { calendar: CalendarDays, payment: CreditCard, complaint: MessageSquareWarning, attendance: UserCheck }
  const activityColorMap: Record<string, string> = { success: 'bg-emerald-500', error: 'bg-red-400', warning: 'bg-amber-400', info: 'bg-teal-400' }
  const activityItems = activityData.slice(0, 10).map((a: any, i: number) => {
    const Icon = activityIconMap[a.icon] || Activity
    const ago = getTimeAgo(a.time)
    return {
      id: `${a.type}-${i}`,
      dotColor: activityColorMap[a.type] || 'bg-gray-400',
      description: a.detail,
      timestamp: ago,
      amount: a.label,
      icon: Icon,
    }
  })

  /* ── Time ago helper ── */
  function getTimeAgo(isoStr: string): string {
    const now = Date.now()
    const then = new Date(isoStr).getTime()
    const diff = Math.max(0, now - then)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs }h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return format(parseISO(isoStr), 'MMM dd')
  }

  /* ── Custom donut label ── */
  const renderDonutLabel = ({ name, percent }: { name: string; percent: number }) =>
    `${name} ${(percent * 100).toFixed(0)}%`

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        custom={0} variants={sectionVariants} initial="hidden" animate="visible"
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Khobra Cleaning Service – Operations Overview</p>
        </div>
        <Badge variant="outline" className="hidden sm:flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </Badge>
      </motion.div>

      {/* ── Welcome Banner (with real next-booking) ── */}
      <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 overflow-hidden">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome back, Ahmed Khan</h2>
              <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening at Khobra Cleaning Service today.</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-mono text-sm font-medium">{timeStr}</span>
                </span>
                <span className="hidden sm:inline text-muted-foreground/40">|</span>
                <span className="hidden sm:inline">
                  {stats.todayBookings} booking{stats.todayBookings !== 1 ? 's' : ''} scheduled today
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl px-6 py-5 text-white shrink-0 shadow-lg shadow-emerald-500/20">
              {nextBooking ? (
                <>
                  <Sparkles className="h-7 w-7 opacity-90" strokeWidth={1.5} />
                  <span className="text-xs font-medium opacity-90">Next in {timeUntilNext}</span>
                  <span className="text-sm font-bold text-center leading-tight max-w-[160px] truncate">
                    {nextBooking.service?.name || 'Service'}
                  </span>
                  <span className="text-[11px] opacity-80 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {nextBooking.customer?.user?.name || 'Customer'}
                  </span>
                  <span className="text-[11px] opacity-70 font-mono">{nextBookingTime}</span>
                </>
              ) : (
                <>
                  <CalendarCheck className="h-7 w-7 opacity-90" strokeWidth={1.5} />
                  <span className="text-sm font-semibold">No more bookings</span>
                  <span className="text-xs opacity-80">All done for today!</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Quick Actions Bar ── */}
      <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.view + action.label}
              variant="outline"
              className="rounded-lg border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 dark:hover:border-emerald-600 gap-2 h-9 px-3 text-xs sm:text-sm"
              onClick={() => setView(action.view)}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} {...kpi} index={i} />
        ))}
      </div>

      {/* ── Summary Stat Strip ── */}
      <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold text-foreground">{weekBookings}</span> bookings this week
              </span>
              <span className="hidden sm:inline text-muted-foreground/30">\u00b7</span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold text-foreground">AED {Math.round(weekRevenue).toLocaleString()}</span> revenue
              </span>
              <span className="hidden sm:inline text-muted-foreground/30">\u00b7</span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold text-foreground">AED {avgPerBooking.toLocaleString()}</span> avg/booking
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Revenue Bar Chart + Donut + Completion Gauge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Chart */}
        <motion.div custom={5} variants={sectionVariants} initial="hidden" animate="visible" className="lg:col-span-5">
          <Card className="border-0 shadow-sm rounded-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Revenue Trend</CardTitle>
              <CardDescription className="text-xs">Last 7 days \u00b7 Paid invoices in AED</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<AedTooltip />} />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Donut Chart */}
        <motion.div custom={6} variants={sectionVariants} initial="hidden" animate="visible" className="lg:col-span-4">
          <Card className="border-0 shadow-sm rounded-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Booking Status</CardTitle>
              <CardDescription className="text-xs">Distribution by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDonutData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={renderDonutLabel}
                      labelLine={{ stroke: 'hsl(var(--muted))' }}
                    >
                      {statusDonutData.map((entry, i) => (
                        <Cell key={i} fill={statusDonutColors [entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completion Rate Gauge */}
        <motion.div custom={7} variants={sectionVariants} initial="hidden" animate="visible" className="lg:col-span-3">
          <Card className="border-0 shadow-sm rounded-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Completion Rate</CardTitle>
              <CardDescription className="text-xs">All-time booking success</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <CompletionGauge percentage={completionRate} label="completed" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Unassigned Work Queue ── */}
      <motion.div custom={8} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Unassigned Work Queue
            </CardTitle>
            <CardDescription className="text-xs">Bookings pending staff assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {unassignedBookings?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CalendarCheck className="h-10 w-10 mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium">All bookings assigned</p>
                <p className="text-xs mt-0.5">No pending assignments right now</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                {unassignedBookings?.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors ">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.customer?.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{b.service?.name} \u00b7 {format(parseISO(b.scheduledDate), 'MMM dd')} {b.startTime}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className="text-xs font-semibold text-foreground">AED {(b.netAmount || 0).toLocaleString()}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Today's Bookings + Activity Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Bookings */}
        <motion.div custom={9} variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                Today&apos;s Bookings
              </CardTitle>
              <CardDescription className="text-xs">Scheduled for {format(new Date(), 'EEEE, MMM dd')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Service</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                    {todaysBookings?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                          <p className="text-sm">No bookings scheduled today</p>
                        </TableCell>
                      </TableRow>
                    ) : todaysBookings?.map((b: any, idx: number) => (
                      <motion.tr
                        key={b.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.03 }}
                        className={`border-b border-border/40 ${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                      >
                        <TableCell className="text-sm font-medium">{b.customer?.user?.name}</TableCell>
                        <TableCell className="text-sm">{b.service?.name}</TableCell>
                        <TableCell className="text-sm font-mono text-xs">{b.startTime}</TableCell>
                        <TableCell>
                          <Badge className={`${statusBadgeColors [b.status] || ''} text-[11px] px-2 py-0.5`}>{b.status}</Badge>
                        </TableCell>
                      </motion.tr>
                    ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity Timeline */}
        <motion.div custom={10} variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs">Bookings, payments, complaints & attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto pr-1">
                {activityItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Activity className="h-10 w-10 mb-3 text-muted-foreground/40" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-300 via-teal-300 to-muted" />
                    <div className="space-y-4">
                      {activityItems.map((item: any) => {
                        const ItemIcon = item.icon || Activity
                        return (
                          <div key={item.id} className="relative flex gap-3">
                            <span className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${item.dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <ItemIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="text-sm leading-snug truncate">{item.description}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-1 ml-5.5">
                                <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{item.amount}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}


