'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import {
  CalendarDays, Wallet, MessageSquareWarning, FileText, Clock, ArrowRight, CreditCard, TrendingUp, ChevronRight, Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'
import { ServiceCards } from './public-site'
import { useRealtime } from '@/hooks/use-realtime'

const statusColors : Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  scheduled: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  on_the_way: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  pending_assignment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}
export function CustomerPortal() {
  const setView = useAppStore(s => s.setView)
  const qc = useQueryClient()
  const { subscribe, onEvent } = useRealtime()
  useEffect(() => { subscribe('booking:updated'); onEvent('booking:updated', () => qc.invalidateQueries({ queryKey: ['bookings'] })) }, [onEvent, qc, subscribe])

  const { data: bookings = [], isLoading: bLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => fetch('/api/khobra-cleaning/bookings').then(r => r.json()),
  })

  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ['complaints'],
    queryFn: () => fetch('/api/khobra-cleaning/complaints').then(r => r.json()),
  })

  const { data: invoices = [], isLoading: iLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => fetch('/api/khobra-cleaning/invoices').then(r => r.json()),
  })
  const loading = bLoading || cLoading || iLoading

  const today = startOfDay(new Date())
  const upcoming = bookings
    .filter((b: any) => ['pending', 'pending_assignment', 'assigned', 'confirmed', 'scheduled', 'on_the_way', 'in_progress'].includes(b.status))
    .sort((a: any, b: any) => {
      const dateA = new Date(a.scheduledDate)
      const dateB = new Date(b.scheduledDate)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 5)

  const openComplaints = complaints.filter((c: any) => ['open', 'in_progress'].includes(c.status))
  const totalSpent = invoices
    .filter((inv: any) => inv.status === 'paid')
    .reduce((s: number, inv: any) => s + (inv.paidAmount || 0), 0)

  const activeCount = bookings.filter((b: any) => ['pending', 'pending_assignment', 'assigned', 'confirmed', 'scheduled', 'on_the_way', 'in_progress'].includes(b.status)).length

  const monthlySpend: Record<string, number> = {}
  invoices.forEach((inv: any) => {
    if (inv.status === 'paid' && inv.issuedAt) {
      const month = format(parseISO(inv.issuedAt), 'MMM yyyy')
      monthlySpend[month] = (monthlySpend[month] || 0) + (inv.totalAmount || 0)
    }
   })
  const maxSpend = Math.max(...Object.values(monthlySpend), 1)

  const kpis = [
    { icon: CalendarDays, label: 'My Bookings', value: bookings.length, color: 'bg-emerald-600', sub: `${activeCount} active` },
    { icon: CreditCard, label: 'Total Spent', value: `AED ${totalSpent.toLocaleString()}`, color: 'bg-teal-600', sub: `${invoices.length} invoices` },
    { icon: MessageSquareWarning, label: 'Open Issues', value: openComplaints.length, color: openComplaints.length > 0 ? 'bg-red-500' : 'bg-emerald-600', pulse: openComplaints.length > 0 },
    { icon: TrendingUp, label: 'Avg per Booking', value: bookings.length > 0 ? `AED ${Math.round(totalSpent / bookings.length).toLocaleString()}` : 'AED 0', color: 'bg-cyan-600' },
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
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20 overflow-hidden">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome back, Fatima Ali</h2>
              <p className="text-sm text-muted-foreground">Here&apos;s your service activity overview.</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 dark:bg-white/5 rounded-2xl px-6 py-4 shrink-0">
              <Sparkles className="h-16 w-16 text-emerald-600 opacity-80" strokeWidth={1.2} />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <section className="rounded-[2rem] border border-emerald-100/80 bg-gradient-to-br from-white/80 to-emerald-50/70 p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-600">Made for your space</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Book your next clean</h2>
          </div>
          <a href="/book" className="hidden items-center gap-1 text-sm font-bold text-emerald-700 sm:flex">All services <ArrowRight className="h-4 w-4" /></a>
        </div>
        <ServiceCards limit={3} />
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className={`absolute top-0 left-0 right-0 h-1 ${kpi.color}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                    {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
                  </div>
                  <div className={`p-2 rounded-xl ${kpi.color} ${kpi.pulse ? 'animate-pulse' : ''}`}>
                    <kpi.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bookings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Upcoming Bookings</CardTitle>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setView('bookings')}>
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No upcoming bookings</p>
                ) : upcoming.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => setView('bookings')}>
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.items && b.items.length > 0 ? b.items.map((i: any) => i.service?.name).join(', ') : (b.service?.name || 'Service')}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(b.scheduledDate), 'EEE, MMM d')} · {b.startTime}{b.endTime ? ` - ${b.endTime}` : ''} ({b.duration}h)</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">AED {(b.netAmount || 0).toLocaleString()}</p>
                      <Badge className={`ml-2 ${statusColors [b.status] || ''}`}>{b.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Spending + Complaints */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Spending Overview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Monthly bars */}
              <div className="space-y-2">
                {Object.entries(monthlySpend).slice(-4).map(([month, amount]) => (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{month}</span>
                    <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(amount / maxSpend) * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums">AED {Math.round(amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3" />
              {/* Complaints */}
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Recent Complaints</p>
              {complaints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No complaints</p>
              ) : complaints.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={statusColors [c.status] || ''}>{c.status.replace('_', ' ')}</Badge>
                    <span className="text-sm truncate">{c.description}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{format(parseISO(c.createdAt), 'MMM d')}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}


