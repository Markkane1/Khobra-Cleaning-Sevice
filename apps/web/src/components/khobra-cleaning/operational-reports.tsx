'use client'

import { useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadBlob, exportToCSV } from '@/lib/csv-export'

type Row = Record<string, string | number>

const day = (value: string | Date) => format(new Date(value), 'yyyy-MM-dd')
const hoursFor = (assignment: any, booking: any) => {
  if (typeof assignment.actualHours === 'number') return assignment.actualHours
  if (assignment.startedAt && assignment.completedAt) return Math.max(0, (new Date(assignment.completedAt).getTime() - new Date(assignment.startedAt).getTime()) / 3_600_000)
  return 0
}

async function exportPdf(title: string, rows: Row[]) {
  if (!rows.length) return toast.error('There is no data in this date range')
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: Object.keys(rows[0]).length > 6 ? 'landscape' : 'portrait' })
  doc.setFontSize(15)
  doc.text(title, 14, 16)
  autoTable(doc, { startY: 22, head: [Object.keys(rows[0])], body: rows.map(row => Object.values(row)) })
  await downloadBlob(doc.output('blob'), `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
}

export function OperationalReports({ bookings, currency = 'AED' }: { bookings: any[]; currency?: string }) {
  const now = new Date()
  const [from, setFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))

  const setPreset = (preset: 'today' | 'week' | 'month') => {
    const start = preset === 'today' ? now : preset === 'week' ? subDays(now, 6) : startOfMonth(now)
    setFrom(format(start, 'yyyy-MM-dd'))
    setTo(format(preset === 'month' ? endOfMonth(now) : now, 'yyyy-MM-dd'))
  }

  const inRange = (value: string | Date) => { const date = day(value); return (!from || date >= from) && (!to || date <= to) }
  const scoped = useMemo(() => bookings.filter(booking => inRange(booking.scheduledDate)), [bookings, from, to])
  const completed = useMemo(() => bookings.filter(booking => booking.status === 'completed' && booking.completedAt && inRange(booking.completedAt)), [bookings, from, to])

  const bookingRows = useMemo<Row[]>(() => scoped.map(booking => ({
    'Booking Reference': booking.bookingNo,
    Date: day(booking.scheduledDate),
    Customer: booking.customer?.user?.name || '-',
    Service: booking.service?.name || booking.items?.[0]?.service?.name || '-',
    Status: String(booking.status).replaceAll('_', ' '),
    'Scheduled Hours': Number(booking.duration || 0).toFixed(2),
    Cleaners: booking.assignments?.map((item: any) => item.employee?.user?.name).filter(Boolean).join(', ') || '-',
    Amount: Number(booking.netAmount || 0).toFixed(2),
  })), [scoped])

  const completedRows = useMemo<Row[]>(() => completed.map(booking => ({
    'Booking Reference': booking.bookingNo,
    Date: day(booking.completedAt),
    Customer: booking.customer?.user?.name || '-',
    Service: booking.service?.name || booking.items?.[0]?.service?.name || '-',
    Status: 'completed',
    'Scheduled Hours': Number(booking.duration || 0).toFixed(2),
    Cleaners: booking.assignments?.map((item: any) => item.employee?.user?.name).filter(Boolean).join(', ') || '-',
    Amount: Number(booking.invoices?.[0]?.totalAmount ?? booking.netAmount ?? 0).toFixed(2),
  })), [completed])

  const assignmentRows = useMemo<Row[]>(() => bookings.flatMap(booking => (booking.assignments || []).filter((assignment: any) => inRange(assignment.completedAt || booking.scheduledDate)).map((assignment: any) => ({
    Cleaner: assignment.employee?.user?.name || '-',
    'Booking Reference': booking.bookingNo,
    Date: day(assignment.completedAt || booking.scheduledDate),
    Customer: booking.customer?.user?.name || '-',
    Status: String(booking.status).replaceAll('_', ' '),
    'Hours Worked': hoursFor(assignment, booking).toFixed(2),
    Rating: typeof assignment.customerRating === 'number' ? assignment.customerRating.toFixed(1) : '-',
    Feedback: assignment.ratingNotes || booking.rating?.comment || '-',
  }))), [bookings, from, to])

  const employeeSummary = useMemo<Row[]>(() => Object.values(assignmentRows.reduce<Record<string, any>>((all, row) => {
    const key = String(row.Cleaner)
    all[key] ||= { Cleaner: key, Assignments: 0, 'Completed Bookings': 0, 'Total Hours': 0, ratings: [] as number[] }
    all[key].Assignments++
    if (row.Status === 'completed') all[key]['Completed Bookings']++
    all[key]['Total Hours'] += Number(row['Hours Worked'])
    if (row.Rating !== '-') all[key].ratings.push(Number(row.Rating))
    return all
  }, {})).map((item: any) => ({
    Cleaner: item.Cleaner,
    Assignments: item.Assignments,
    'Completed Bookings': item['Completed Bookings'],
    'Total Hours': item['Total Hours'].toFixed(2),
    'Average Rating': item.ratings.length ? (item.ratings.reduce((sum: number, value: number) => sum + value, 0) / item.ratings.length).toFixed(1) : '-',
  })), [assignmentRows])

  const download = (name: string, rows: Row[], pdf = false) => {
    if (!rows.length) return toast.error('There is no data in this date range')
    if (pdf) return void exportPdf(name, rows)
    exportToCSV(rows, name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }

  const actions = (name: string, rows: Row[]) => <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" onClick={() => download(name, rows)}><Download className="mr-1.5 h-4 w-4" />Excel (CSV)</Button>
    <Button size="sm" variant="outline" onClick={() => download(name, rows, true)}><FileText className="mr-1.5 h-4 w-4" />PDF</Button>
  </div>

  const bookingTable = (rows: any[]) => <div className="max-h-[390px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Hours</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map(row => <TableRow key={String(row['Booking Reference'])}><TableCell className="font-mono text-xs">{row['Booking Reference']}</TableCell><TableCell>{row.Date}</TableCell><TableCell>{row.Customer}</TableCell><TableCell>{row.Service}</TableCell><TableCell><Badge variant="outline" className="capitalize">{row.Status}</Badge></TableCell><TableCell>{row['Scheduled Hours']}</TableCell><TableCell>{currency} {row.Amount}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No records in this date range.</TableCell></TableRow>}</TableBody></Table></div>

  return <Card className="border-0 shadow-sm">
    <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><CardTitle>Operational Reports</CardTitle><CardDescription>Booking records, completed work and cleaner assignment history.</CardDescription></div>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={event => setTo(event.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={() => setPreset('today')}>Today</Button>
        <Button size="sm" variant="outline" onClick={() => setPreset('week')}>Last 7 days</Button>
        <Button size="sm" variant="outline" onClick={() => setPreset('month')}>This month</Button>
      </div>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="bookings">
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1"><TabsTrigger value="bookings" className="flex-none">All Bookings ({bookingRows.length})</TabsTrigger><TabsTrigger value="completed" className="flex-none">Completed ({completed.length})</TabsTrigger><TabsTrigger value="assignments" className="flex-none">Cleaner Assignments ({assignmentRows.length})</TabsTrigger></TabsList>
        <TabsContent value="bookings" className="space-y-3"><div className="flex justify-end">{actions(`Booking Record ${from} to ${to}`, bookingRows)}</div>{bookingTable(bookingRows)}</TabsContent>
        <TabsContent value="completed" className="space-y-3"><div className="flex justify-end">{actions(`Completed Bookings ${from} to ${to}`, completedRows)}</div>{bookingTable(completedRows)}</TabsContent>
        <TabsContent value="assignments" className="space-y-5">
          <div className="flex justify-end">{actions(`Cleaner Hours Summary ${from} to ${to}`, employeeSummary)}</div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Assignments</TableHead><TableHead>Completed</TableHead><TableHead>Total Hours</TableHead><TableHead>Average Rating</TableHead></TableRow></TableHeader><TableBody>{employeeSummary.map(row => <TableRow key={String(row.Cleaner)}><TableCell>{row.Cleaner}</TableCell><TableCell>{row.Assignments}</TableCell><TableCell>{row['Completed Bookings']}</TableCell><TableCell>{row['Total Hours']}</TableCell><TableCell>{row['Average Rating']}</TableCell></TableRow>)}</TableBody></Table></div>
          <div className="flex justify-end">{actions(`Cleaner Assignment History ${from} to ${to}`, assignmentRows)}</div>
          <div className="max-h-[360px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Booking</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>Rating</TableHead><TableHead>Customer Feedback</TableHead></TableRow></TableHeader><TableBody>{assignmentRows.map((row, index) => <TableRow key={`${row['Booking Reference']}-${row.Cleaner}-${index}`}><TableCell>{row.Cleaner}</TableCell><TableCell className="font-mono text-xs">{row['Booking Reference']}</TableCell><TableCell>{row.Date}</TableCell><TableCell>{row['Hours Worked']}</TableCell><TableCell>{row.Rating}</TableCell><TableCell className="max-w-xs whitespace-normal">{row.Feedback}</TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
}
