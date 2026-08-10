'use client'

import { useMemo, useState } from 'react'
import { format, startOfMonth, subDays, startOfYear } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, CalendarRange, CircleDollarSign, ClipboardCheck, ReceiptText, Sparkles, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiRequest } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ReportData = {
  period: { from: string; to: string; days: number; previousFrom: string; previousTo: string }
  currency: string
  summary: Record<string, any> & { changes: Record<string, number | null> }
  series: Array<{ date: string; revenue: number; expenses: number; bookings: number; completed: number }>
  statuses: Array<{ name: string; value: number }>
  paymentMethods: Array<{ name: string; value: number }>
  services: Array<{ name: string; bookings: number; bookedValue: number; completionRate: number }>
  materialOperations: Array<{ name: string; reserved: number; consumed: number; released: number; estimatedCost: number }>
  areas: Array<{ name: string; value: number }>
  expenseCategories: Array<{ name: string; value: number }>
  weekdays: Array<{ name: string; value: number }>
  peakHours: Array<{ name: string; value: number }>
  staff: Array<{ name: string; assignments: number; completed: number; hours: number; completionRate: number; averageRating: number | null }>
  serviceQuality: { complaints: number; complaintResolutionRate: number; averageResolutionHours: number }
}

const COLORS = ['#059669', '#0d9488', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#64748b', '#db2777']
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

function Trend({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">New in this period</span>
  if (value === 0) return <span className="text-[11px] text-muted-foreground">No change</span>
  const up = value >= 0
  const favorable = inverse ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return <span className={`inline-flex items-center text-[11px] font-medium ${favorable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}><Icon className="mr-0.5 h-3.5 w-3.5" />{Math.abs(value)}% vs previous</span>
}

function formatMoney(currency: string, value: number) {
  return `${currency} ${Math.round(value || 0).toLocaleString()}`
}

export function ReportInsights() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ['detailed-reports', from, to],
    queryFn: () => apiRequest(`/api/khobra-cleaning/reports?from=${from}&to=${to}`),
    enabled: Boolean(from && to && from <= to),
  })

  const preset = (value: '7' | '30' | 'month' | 'year') => {
    setTo(today)
    setFrom(format(value === 'month' ? startOfMonth(new Date()) : value === 'year' ? startOfYear(new Date()) : subDays(new Date(), Number(value) - 1), 'yyyy-MM-dd'))
  }

  const insights = useMemo(() => {
    if (!data) return []
    const s = data.summary
    const items = []
    if (s.changes.revenue !== null) items.push({ tone: s.changes.revenue >= 0 ? 'good' : 'warn', text: `Collected revenue ${s.changes.revenue >= 0 ? 'increased' : 'decreased'} ${Math.abs(s.changes.revenue)}% compared with the previous ${data.period.days}-day period.` })
    if (s.netCashFlow < 0) items.push({ tone: 'warn', text: `Outflow exceeded collected revenue by ${formatMoney(data.currency, Math.abs(s.netCashFlow))}. Review the expense breakdown and collection backlog.` })
    if (s.noShow || s.cancelled) items.push({ tone: 'warn', text: `${s.cancelled + s.noShow} bookings were lost to cancellations or no-shows, representing ${s.bookings ? Math.round(((s.cancelled + s.noShow) / s.bookings) * 100) : 0}% of demand.` })
    if (s.outstanding > 0) items.push({ tone: s.collectionRate < 80 ? 'warn' : 'neutral', text: `${formatMoney(data.currency, s.outstanding)} remains outstanding. The invoice collection rate is ${s.collectionRate}%.` })
    if (data.services[0]) items.push({ tone: 'good', text: `${data.services[0].name} is the leading service with ${data.services[0].bookings} bookings and ${formatMoney(data.currency, data.services[0].bookedValue)} in booked value.` })
    if (data.weekdays[0]) items.push({ tone: 'neutral', text: `${data.weekdays[0].name} is the busiest day. Use this when planning cleaner and driver coverage.` })
    return items.slice(0, 4)
  }, [data])

  return <section className="space-y-4" aria-labelledby="executive-report-title">
    <Card className="border-0 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle id="executive-report-title" className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-emerald-600" />Executive Performance</CardTitle>
          <CardDescription>Every metric below uses the same selected period and compares it with the immediately preceding period.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label htmlFor="report-from" className="text-xs">From</Label><Input id="report-from" type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className="min-h-11" /></div>
          <div><Label htmlFor="report-to" className="text-xs">To</Label><Input id="report-to" type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} className="min-h-11" /></div>
          <Button variant="outline" className="min-h-11" onClick={() => preset('7')}>7 days</Button>
          <Button variant="outline" className="min-h-11" onClick={() => preset('30')}>30 days</Button>
          <Button variant="outline" className="min-h-11" onClick={() => preset('month')}>Month</Button>
          <Button variant="outline" className="min-h-11" onClick={() => preset('year')}>Year</Button>
        </div>
      </CardHeader>
    </Card>

    {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load the report.'}</CardContent></Card>}
    {isLoading && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>}

    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: CircleDollarSign, name: 'Cash Collected', value: formatMoney(data.currency, data.summary.revenue), detail: `Booked value ${formatMoney(data.currency, data.summary.bookedValue)}`, change: data.summary.changes.revenue, inverse: false },
          { icon: ReceiptText, name: 'Total Outflow', value: formatMoney(data.currency, data.summary.expenses), detail: `Net cash flow ${formatMoney(data.currency, data.summary.netCashFlow)}`, change: data.summary.changes.expenses, inverse: true },
          { icon: ClipboardCheck, name: 'Bookings', value: data.summary.bookings.toLocaleString(), detail: `${data.summary.completed} completed · ${data.summary.completionRate}% rate`, change: data.summary.changes.bookings, inverse: false },
          { icon: Users, name: 'Customers', value: data.summary.uniqueCustomers.toLocaleString(), detail: `${data.summary.repeatCustomers} repeat customers`, change: data.summary.changes.customers, inverse: false },
        ].map(item => <Card key={item.name} className="border-0 shadow-sm"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"><item.icon className="h-5 w-5" /></span><Trend value={item.change} inverse={item.inverse} /></div><p className="text-xs text-muted-foreground">{item.name}</p><p className="mt-0.5 text-xl font-bold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>)}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-amber-500" />Decision Support</CardTitle><CardDescription>Highlights generated directly from the selected period.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">{insights.map((item, index) => <div key={index} className={`rounded-xl border p-3 text-sm leading-6 ${item.tone === 'good' ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' : item.tone === 'warn' ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20' : 'bg-muted/40'}`}>{item.text}</div>)}</CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-0 shadow-sm xl:col-span-2">
          <CardHeader><CardTitle className="text-base">Cash Flow and Workload</CardTitle><CardDescription>Collected revenue and actual outflow, with daily booking volume.</CardDescription></CardHeader>
          <CardContent><div className="h-[340px]" role="img" aria-label="Daily revenue, expenses, and bookings chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.series}><CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" /><XAxis dataKey="date" tickFormatter={value => format(new Date(`${value}T00:00:00`), data.period.days > 90 ? 'MMM' : 'MMM d')} minTickGap={24} tick={{ fontSize: 11 }} /><YAxis yAxisId="money" tick={{ fontSize: 11 }} /><YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number, name: string) => [name === 'Bookings' ? value : formatMoney(data.currency, value), name]} labelFormatter={value => format(new Date(`${value}T00:00:00`), 'MMM d, yyyy')} /><Legend /><Bar yAxisId="money" dataKey="revenue" name="Revenue" fill="#059669" radius={[4, 4, 0, 0]} /><Bar yAxisId="money" dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} /><Line yAxisId="count" type="monotone" dataKey="bookings" name="Bookings" stroke="#2563eb" strokeWidth={2.5} dot={false} /></ComposedChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Financial and Service Health</CardTitle><CardDescription>Collection, cash position, and customer issue handling.</CardDescription></CardHeader>
          <CardContent className="space-y-5">{[
            ['Net Cash Flow', formatMoney(data.currency, data.summary.netCashFlow)],
            ['Average Booking Value', formatMoney(data.currency, data.summary.averageBookingValue)],
            ['Invoiced', formatMoney(data.currency, data.summary.invoiced)],
            ['Outstanding', formatMoney(data.currency, data.summary.outstanding)],
            ['Collection Rate', `${data.summary.collectionRate}%`],
            ['Complaints', data.serviceQuality.complaints.toLocaleString()],
            ['Complaint Resolution', `${data.serviceQuality.complaintResolutionRate}%`],
            ['Average Resolution Time', `${data.serviceQuality.averageResolutionHours} hours`],
          ].map(([name, value]) => <div key={name} className="flex items-center justify-between border-b pb-3 last:border-0"><span className="text-sm text-muted-foreground">{name}</span><span className="font-semibold tabular-nums">{value}</span></div>)}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1"><TabsTrigger className="min-h-11" value="services">Services</TabsTrigger><TabsTrigger className="min-h-11" value="demand">Demand</TabsTrigger><TabsTrigger className="min-h-11" value="expenses">Expenses</TabsTrigger><TabsTrigger className="min-h-11" value="staff">Staff</TabsTrigger></TabsList>
        <TabsContent value="services" className="space-y-4"><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Service Performance</CardTitle><CardDescription>Each booked service line is attributed independently for the selected period.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Booked Value</TableHead><TableHead className="text-right">Completion</TableHead></TableRow></TableHeader><TableBody>{data.services.map(item => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-right tabular-nums">{item.bookings}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(data.currency, item.bookedValue)}</TableCell><TableCell className="text-right tabular-nums">{item.completionRate}%</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Material Operations</CardTitle><CardDescription>Reservations and consumption from BOMs in the selected period. Estimated cost is internal only.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Inventory item</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Consumed</TableHead><TableHead className="text-right">Released</TableHead><TableHead className="text-right">Est. cost</TableHead></TableRow></TableHeader><TableBody>{data.materialOperations.map(item => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-right tabular-nums">{item.reserved}</TableCell><TableCell className="text-right tabular-nums">{item.consumed}</TableCell><TableCell className="text-right tabular-nums">{item.released}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(data.currency, item.estimatedCost)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
        <TabsContent value="demand"><div className="grid gap-4 lg:grid-cols-3">{[['Booking Status', data.statuses], ['Busiest Days', data.weekdays], ['Top Areas', data.areas]].map(([title, values]) => <Card key={title as string} className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">{title as string}</CardTitle></CardHeader><CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={values as any[]} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={90} tickFormatter={label} tick={{ fontSize: 11 }} /><Tooltip labelFormatter={label} /><Bar dataKey="value" name="Bookings" radius={[0, 5, 5, 0]}>{(values as any[]).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>)}</div></TabsContent>
        <TabsContent value="expenses"><div className="grid gap-4 lg:grid-cols-2"><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Outflow by Category</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.expenseCategories} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number) => formatMoney(data.currency, value)} /><Bar dataKey="value" name="Outflow" fill="#f59e0b" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Payments by Method</CardTitle></CardHeader><CardContent className="space-y-4">{data.paymentMethods.map((item, index) => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{label(item.name)}</span><span className="font-semibold tabular-nums">{formatMoney(data.currency, item.value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${data.summary.revenue ? (item.value / data.summary.revenue) * 100 : 0}%`, background: COLORS[index % COLORS.length] }} /></div></div>)}</CardContent></Card></div></TabsContent>
        <TabsContent value="staff"><Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base">Cleaner Performance</CardTitle><CardDescription>Assignments, completed work, hours, and verified customer ratings.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead className="text-right">Assignments</TableHead><TableHead className="text-right">Completed</TableHead><TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Completion</TableHead><TableHead className="text-right">Rating</TableHead></TableRow></TableHeader><TableBody>{data.staff.map(item => <TableRow key={item.name}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="text-right">{item.assignments}</TableCell><TableCell className="text-right">{item.completed}</TableCell><TableCell className="text-right">{item.hours.toFixed(1)}</TableCell><TableCell className="text-right">{item.completionRate}%</TableCell><TableCell className="text-right">{item.averageRating ? `${item.averageRating.toFixed(1)} / 5` : 'No ratings'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
      </Tabs>
    </>}
  </section>
}
