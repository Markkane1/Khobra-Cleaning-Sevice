'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, addDays, startOfDay, startOfWeek, endOfWeek } from 'date-fns'
import {
  BarChart3, TrendingUp, Users, Briefcase, DollarSign, CalendarCheck,
  UserCheck, ShieldCheck, Star, MapPin, Trophy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { OperationalReports } from './operational-reports'
import { apiRequest } from '@/lib/api-client'

/* ------------------------------------------------------------------ */
/*  Color Palette (emerald/teal only)                                  */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  confirmed: '#14b8a6',
  in_progress: '#f97316',
  pending: '#f59e0b',
  cancelled: '#ef4444',
}

const SERVICE_COLORS = ['#10b981', '#14b8a6', '#0d9488', '#059669', '#047857', '#065f46']

/* ------------------------------------------------------------------ */
/*  Animation Variants                                                 */
/* ------------------------------------------------------------------ */

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

/* ------------------------------------------------------------------ */
/*  Shared Tooltip Style                                               */
/* ------------------------------------------------------------------ */

const tooltipStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 13,
}

function AedTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="font-medium text-xs mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color || '#10b981' }}>
          {entry.name}: {currency} {(entry.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function DefaultTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="font-medium text-xs mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color || '#10b981' }}>
          {entry.name}: {entry.value ?? 0}
        </p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Circular Metric Indicator                                          */
/* ------------------------------------------------------------------ */

function CircularMetric({ percentage, label, icon: Icon, color }: {
  percentage: number; label: string; icon: React.ElementType; color: string
}) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold" style={{ color }}>{percentage}%</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Progress Metric Row                                                */
/* ------------------------------------------------------------------ */

function ProgressMetric({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color: string; suffix?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toLocaleString()}{suffix || ''} <span className="text-xs text-muted-foreground font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Reports Component                                             */
/* ------------------------------------------------------------------ */

export function Reports() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<any>('/api/khobra-cleaning/dashboard'),
  })

  const { data: bookings = [], isLoading: bookLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/bookings'),
  })

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/invoices'),
  })

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/complaints'),
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => apiRequest<any>('/api/khobra-cleaning/settings') })
  const currency = settings?.tenant?.currency || 'AED'

  const { data: ratingSubmissions = [] } = useQuery({
    queryKey: ['booking-ratings'],
    queryFn: () => apiRequest<any>('/api/khobra-cleaning/bookings/rate'),
  })

  /* ── Loading skeleton ── */
  if (dashLoading || !dashboard) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-[360px] w-full rounded-xl" />
      </div>
    )
  }

  const { stats } = dashboard

  /* ── Revenue by day ── */
  const revData = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(startOfDay(new Date()), -6 + i), 'MMM dd')
    const dayRev = dashboard.revenueByDay
      ?.filter((r: { issuedAt: string }) => format(parseISO(r.issuedAt), 'MMM dd') === d)
      .reduce((sum: number, r: { totalAmount: number }) => sum + (r.totalAmount || 0), 0) || 0
    return { day: d, revenue: Math.round(dayRev) }
  })

  /* ── Area chart data (extended to 14 days for smoother trend) ── */
  const areaData = Array.from({ length: 14 }, (_, i) => {
    const d = format(addDays(startOfDay(new Date()), -13 + i), 'MMM dd')
    const dayRev = dashboard.revenueByDay
      ?.filter((r: { issuedAt: string }) => format(parseISO(r.issuedAt), 'MMM dd') === d)
      .reduce((sum: number, r: { totalAmount: number }) => sum + (r.totalAmount || 0), 0) || 0
    return { day: d, revenue: Math.round(dayRev) }
  })

  /* ── Booking status distribution ── */
  const statusData = Object.entries(stats.bookingStatusCounts || {}).map(([status, value]) => ({ name: status.replaceAll('_', ' '), value: Number(value) })).filter(d => d.value > 0)

  /* ── Service popularity ── */
  const serviceMap: Record<string, number> = {}
  bookings.forEach((b: any) => {
    const n = b.service?.name || 'Unknown'
    serviceMap[n] = (serviceMap[n] || 0) + 1
  })
  const serviceData = Object.entries(serviceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  /* ── Service completion rates ── */
  const serviceCompletionMap: Record<string, { total: number; completed: number }> = {}
  bookings.forEach((b: any) => {
    const n = b.service?.name || 'Unknown'
    if (!serviceCompletionMap[n]) serviceCompletionMap[n] = { total: 0, completed: 0 }
    serviceCompletionMap[n].total++
    if (b.status === 'completed') serviceCompletionMap[n].completed++
  })
  const serviceCompletionData = Object.entries(serviceCompletionMap)
    .map(([name, { total, completed }]) => ({
      name,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)

  /* ── Top customersby revenue ── */
  const customerRevenueMap: Record<string, { name: string; revenue: number; count: number }> = {}
  invoices.forEach((invoice: any) => {
    const cid = invoice.customerId
    const cname = invoice.customer?.user?.name || 'Unknown'
    if (!customerRevenueMap[cid]) customerRevenueMap[cid] = { name: cname, revenue: 0, count: 0 }
    customerRevenueMap[cid].revenue += invoice.paidAmount || 0
    if (invoice.paidAmount > 0) customerRevenueMap[cid].count++
  })
  const topCustomers= Object.values(customerRevenueMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(c => ({ ...c, revenue: Math.round(c.revenue) }))

  /* ── Customer by area distribution ── */
  const areaMap: Record<string, number> = {}
  bookings.forEach((b: any) => {
    const area = b.area || b.customer?.area || 'Other'
    areaMap[area] = (areaMap[area] || 0) + 1
  })
  const customerAreaData = Object.entries(areaMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  /* ── Employee productivity ── */
  const employeeProdMap: Record<string, { name: string; bookings: number; completed: number; ratingTotal: number; ratingCount: number }> = {}
  bookings.forEach((b: any) => {
    b.assignments?.forEach((a: any) => {
      const eid = a.employeeId
      const ename = a.employee?.user?.name || 'Unknown'
      if (!employeeProdMap[eid]) employeeProdMap[eid] = { name: ename, bookings: 0, completed: 0, ratingTotal: 0, ratingCount: 0 }
      employeeProdMap[eid].bookings++
      if (b.status === 'completed') employeeProdMap[eid].completed++
      if (typeof a.customerRating === 'number') {
        employeeProdMap[eid].ratingTotal += a.customerRating
        employeeProdMap[eid].ratingCount++
      }
    })
  })
  const employeeData = Object.values(employeeProdMap)
    .map(e => ({
      ...e,
      rate: e.bookings > 0 ? Math.round((e.completed / e.bookings) * 100) : 0,
      averageRating: e.ratingCount ? Math.round((e.ratingTotal / e.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.bookings - a.bookings)

  /* ── Computed metrics ── */
  const totalRevenue = stats.totalRevenue || 0
  const paidInvoiceCount = invoices.filter((invoice: any) => invoice.paidAmount > 0).length
  const avgBookingValue = paidInvoiceCount > 0 ? Math.round((stats.totalRevenue || 0) / paidInvoiceCount) : 0
  const completionRate = stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0

  // Customer retention: customerswith more than 1 booking
  const customerBookingCounts: Record<string, number> = {}
  bookings.forEach((b: any) => {
    customerBookingCounts[b.customerId] = (customerBookingCounts[b.customerId] || 0) + 1
  })
  const totalCustomers= Object.keys(customerBookingCounts).length
  const returningCustomers= Object.values(customerBookingCounts).filter(c => c > 1).length
  const retentionRate = totalCustomers> 0 ? Math.round((returningCustomers/ totalCustomers) * 100) : 0

  const resolvedComplaints = complaints.filter((complaint: any) => ['resolved', 'closed'].includes(complaint.status)).length
  const totalComplaints = complaints.length
  const complaintResolution = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0

  /* ── KPIs ── */
  const kpis = [
    { icon: DollarSign, label: 'Total Revenue', value: `${currency} ${totalRevenue.toLocaleString()}`, color: 'bg-emerald-600', gradient: 'from-emerald-400 to-teal-500', sub: `Cash ${stats.cashInflow || 0} · Bank ${stats.bankInflow || 0}` },
    { icon: Briefcase, label: 'Total Bookings', value: stats.totalBookings, color: 'bg-teal-600', gradient: 'from-teal-400 to-cyan-500', sub: `${completionRate}% completion rate` },
    { icon: Users, label: 'Customers', value: stats.totalCustomers, color: 'bg-emerald-700', gradient: 'from-emerald-500 to-green-500', sub: `${retentionRate}% returning` },
    { icon: TrendingUp, label: 'Avg Booking Value', value: `${currency} ${avgBookingValue.toLocaleString()}`, color: 'bg-teal-700', gradient: 'from-teal-500 to-cyan-600' },
  ]

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div {...fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight">Reports &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground">Operational insights and performance metrics</p>
      </motion.div>

      <OperationalReports bookings={bookings} currency={currency} />

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: (1 + i) * 0.05 }}>
            <Card className="border-0 shadow-sm rounded-xl relative overflow-hidden hover:shadow-md transition-shadow">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.gradient}`} />
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${kpi.color} shrink-0 transition-transform hover:scale-110`}>
                  <kpi.icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold tracking-tight truncate">{kpi.value}</p>
                  {kpi.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Key Metrics Summary ── */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Key Metrics
            </CardTitle>
            <CardDescription className="text-xs">Operational performance at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <CircularMetric
                percentage={completionRate}
                label="Completion Rate"
                icon={CalendarCheck}
                color="#10b981"
              />
              <CircularMetric
                percentage={Math.min(100, Math.round((avgBookingValue / 5000) * 100))}
                label="Avg Revenue/Booking"
                icon={DollarSign}
                color="#14b8a6"
              />
              <CircularMetric
                percentage={retentionRate}
                label="Customer Retention"
                icon={Users}
                color="#0d9488"
              />
              <CircularMetric
                percentage={complaintResolution}
                label="Complaint Resolution"
                icon={ShieldCheck}
                color="#059669"
              />
            </div>
            <div className="mt-6 space-y-4">
              <ProgressMetric
                label="Booking Completion"
                value={stats.completedBookings}
                max={stats.totalBookings}
                color="#10b981"
              />
              <ProgressMetric
                label="Invoice Payment Collection"
                value={stats.paidInvoices}
                max={stats.totalInvoices}
                color="#14b8a6"
                suffix=" invoices"
              />
              <ProgressMetric
                label="Active Staff Utilization"
                value={stats.activeEmployees}
                max={stats.activeEmployees + stats.onLeaveEmployees}
                color="#0d9488"
                suffix=" staff"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Chart Tabs ── */}
      <motion.div {...fadeUp}>
        <Tabs defaultValue="revenue">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="revenue" className="flex-none text-xs sm:text-sm">Revenue</TabsTrigger>
            <TabsTrigger value="bookings" className="flex-none text-xs sm:text-sm">Bookings</TabsTrigger>
            <TabsTrigger value="services" className="flex-none text-xs sm:text-sm">Services</TabsTrigger>
            <TabsTrigger value="customers" className="flex-none text-xs sm:text-sm">Customer Analytics</TabsTrigger>
            <TabsTrigger value="performance" className="flex-none text-xs sm:text-sm">Performance</TabsTrigger>
          </TabsList>

          {/* ── Revenue Tab ── */}
          <TabsContent value="revenue" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Revenue Trend (14 Days)</CardTitle>
                <CardDescription className="text-xs">Area chart showing revenue from paid invoices with gradient fill</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<AedTooltip currency={currency} />} />
                      <Area
                        type="monotone" dataKey="revenue" name="Revenue"
                        stroke="#10b981" strokeWidth={2.5}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Bookings Tab (Donut) ── */}
          <TabsContent value="bookings" className="mt-4">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Booking Status Distribution</CardTitle>
                <CardDescription className="text-xs">All bookings categorized by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: 'hsl(var(--muted))' }}
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.name.toLowerCase()] || '#94a3b8'} />
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
          </TabsContent>

          {/* ── Services Tab (Horizontal Bar) ── */}
          <TabsContent value="services" className="mt-4">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Service Popularity</CardTitle>
                <CardDescription className="text-xs">Number of bookings per service type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} axisLine={false} tickLine={false} />
                      <Tooltip content={<DefaultTooltip />} />
                      <Bar dataKey="count" name="Bookings" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {serviceData.map((_, i) => (
                          <Cell key={i} fill={SERVICE_COLORS[i % SERVICE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Customer Analytics Tab ── */}
          <TabsContent value="customers" className="mt-4 space-y-4">
            {/* Top 5 Customersby Revenue */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Top 5 Customersby Revenue
                </CardTitle>
                <CardDescription className="text-xs">Highest revenue-generating customers</CardDescription>
              </CardHeader>
              <CardContent>
                {topCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm">No customer data available</p>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCustomers} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => {
                            if (name === 'revenue') return [`${currency} ${value.toLocaleString()}`, 'Revenue']
                            return [value, name]
                          }}
                        />
                        <Bar dataKey="revenue" name="revenue" fill="#14b8a6" radius={[0, 6, 6, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer by Area Distribution */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Customer Distribution by Area
                </CardTitle>
                <CardDescription className="text-xs">Booking volume across Dubai areas</CardDescription>
              </CardHeader>
              <CardContent>
                {customerAreaData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MapPin className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm">No area data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerAreaData.slice(0, 8).map((area, i) => {
                      const maxCount = Math.max(...customerAreaData.map(a => a.count))
                      const pct = maxCount > 0 ? Math.round((area.count / maxCount) * 100) : 0
                      return (
                        <div key={area.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-emerald-500" />
                              {area.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{area.count} booking{area.count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${pct}%`,
                                background: SERVICE_COLORS[i % SERVICE_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Performance Tab ── */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Customer Ratings</CardTitle>
                <CardDescription className="text-xs">Overall service feedback and per-cleaner ratings by booking</CardDescription>
              </CardHeader>
              <CardContent>
                {ratingSubmissions.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No customer ratings submitted yet.</p> : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Overall</TableHead><TableHead>Cleaner Ratings</TableHead><TableHead>Comment</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
                      <TableBody>{ratingSubmissions.map((submission: any) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-mono text-xs font-semibold">{submission.bookingReference}</TableCell>
                          <TableCell><Badge className="bg-amber-100 text-amber-900 border-amber-300">{submission.overallRating} ★</Badge></TableCell>
                          <TableCell className="text-xs">{submission.cleanerRatings.map((rating: any) => `${rating.cleanerName}: ${rating.rating} ★`).join(', ')}</TableCell>
                          <TableCell className="max-w-[220px] text-xs text-muted-foreground">{submission.comment || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{format(new Date(submission.submittedAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Completion Rates Table */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  Service Completion Rates
                </CardTitle>
                <CardDescription className="text-xs">How often each service type gets completed successfully</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceCompletionData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm">No data available</p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs">Service</TableHead>
                          <TableHead className="text-xs text-center">Total</TableHead>
                          <TableHead className="text-xs text-center">Completed</TableHead>
                          <TableHead className="text-xs text-center">Rating</TableHead>
                          <TableHead className="text-xs">Completion Rate</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                        {serviceCompletionData.map((s, i) => (
                          <motion.tr
                            key={s.name}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.03 }}
                            className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                          >
                            <TableCell className="text-sm font-medium">{s.name}</TableCell>
                            <TableCell className="text-sm text-center">{s.total}</TableCell>
                            <TableCell className="text-sm text-center">{s.completed}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[100px]">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${s.rate}%`,
                                      background: s.rate >= 80 ? '#10b981' : s.rate >= 50 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-semibold w-10 text-right">{s.rate}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] px-2 py-0.5 ${
                                s.rate >= 80
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : s.rate >= 50
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {s.rate >= 80 ? 'Excellent' : s.rate >= 50 ? 'Average' : 'Low'}
                              </Badge>
                            </TableCell>
                          </motion.tr>
                        ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employee Productivity Ranking */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                  Cleaner Productivity Ranking
                </CardTitle>
                <CardDescription className="text-xs">Staff ranked by total assignments and completion rate</CardDescription>
              </CardHeader>
              <CardContent>
                {employeeData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <UserCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm">No cleaner assignment data available</p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs w-12">Rank</TableHead>
                          <TableHead className="text-xs">Cleaner</TableHead>
                          <TableHead className="text-xs text-center">Assignments</TableHead>
                          <TableHead className="text-xs text-center">Completed</TableHead>
                          <TableHead className="text-xs">Success Rate</TableHead>
                          <TableHead className="text-xs">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                        {employeeData.map((emp, i) => {
                          const rank = i + 1
                          return (
                            <motion.tr
                              key={emp.name + i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25, delay: i * 0.03 }}
                              className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                            >
                              <TableCell>
                                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                                  rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : rank === 2 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                  : rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                  : 'bg-muted text-muted-foreground'
                                }`}>
                                  {rank}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                              <TableCell className="text-sm text-center">{emp.bookings}</TableCell>
                              <TableCell className="text-sm text-center">{emp.completed}</TableCell>
                              <TableCell className="text-sm text-center">{emp.averageRating ? `${emp.averageRating} ★ (${emp.ratingCount})` : '—'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[100px]">
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${emp.rate}%`,
                                        background: emp.rate >= 80 ? '#10b981' : emp.rate >= 50 ? '#f59e0b' : '#ef4444',
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold w-10 text-right">{emp.rate}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] px-2 py-0.5 ${
                                  emp.rate >= 80
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : emp.rate >= 50
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {emp.rate >= 80 ? 'Top' : emp.rate >= 50 ? 'Good' : 'Needs Improvement'}
                                </Badge>
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}


