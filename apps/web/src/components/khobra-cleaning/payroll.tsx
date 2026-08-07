'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Wallet, TrendingDown, Banknote, CheckCircle2,
  CheckCheck, BarChart3, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSortable } from '@/hooks/use-sort'
import { useTenantCurrency } from '@/hooks/use-tenant-currency'
import { exportToCSV } from '@/lib/csv-export'

interface PayrollRecord {
  id: string
  employeeCode: string
  name: string
  email: string
  baseSalary: number
  daysPresent: number
  daysAbsent: number
  overtimeHours : number
  overtimePay: number
  deductions: number
  grossSalary: number
  netSalary: number
  status: string
  payrollStatus: string
}

interface PayrollSummary {
  totalGross: number
  totalDeductions: number
  totalOvertime: number
  totalNet: number
  employeeCount: number
  month: string
}

const payrollStatusColors : Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

function SalaryBreakdownBar({ base, overtime, deductions, currency }: { base: number; overtime: number; deductions: number; currency: string }) {
  const total = base + overtime + deductions
  if (total === 0) return <div className="w-full h-2 rounded-full bg-muted" />

  const basePct = (base / total) * 100
  const otPct = (overtime / total) * 100
  const dedPct = (deductions / total) * 100

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full h-2 rounded-full overflow-hidden flex cursor-pointer">
            <div className="bg-emerald-500 h-full" style={{ width: `${basePct}%` }} />
            <div className="bg-teal-400 h-full" style={{ width: `${otPct}%` }} />
            <div className="bg-red-400 h-full" style={{ width: `${dedPct}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Base: {currency} {base.toLocaleString()}
            </p>
            {overtime > 0 && (
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                Overtime: {currency} {overtime.toLocaleString()}
              </p>
            )}
            {deductions > 0 && (
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Deductions: {currency} {deductions.toLocaleString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function Payroll() {
  const currency = useTenantCurrency()
  const [search, setSearch] = useState('')
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => fetch('/api/khobra-cleaning/payroll').then(r => r.json()),
  })

  const records: PayrollRecord[] = data?.records || []
  const summary: PayrollSummary = data?.summary || {}

  const approveMut = useMutation({
    mutationFn: (rec: any) =>
      fetch('/api/khobra-cleaning/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: rec.id,
          status: 'approved',
          baseSalary: rec.baseSalary,
          deductions: rec.deductions,
          allowances: rec.overtimePay,
          netSalary: rec.netSalary,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] })
      toast.success('Payroll approved')
    },
    onError: () => toast.error('Failed to approve'),
  })

  const handleBulkApprove = () => {
    const pending = records.filter(r => r.payrollStatus === 'pending')
    if (pending.length === 0) {
      toast.info('No pending records to approve')
      return
    }
    pending.forEach(r => {
      approveMut.mutate(r)
    })
  }

  const getStatus = (r: PayrollRecord) => r.payrollStatus || 'pending'

  const filtered = records.filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.name?.toLowerCase().includes(s) ||
      r.employeeCode?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s)
    )
  })

  const { sorted: sortedPayroll, SortableHeader } = useSortable<any>(filtered, 'name')

  const pendingCount = filtered.filter(r => getStatus(r) === 'pending').length

  // Distribution chart data - net salary buckets
  const distributionData = (() => {
    if (records.length === 0) return []
    const buckets: Record<string, number> = {
      '0-20K': 0,
      '20-40K': 0,
      '40-60K': 0,
      '60-80K': 0,
      '80K+': 0,
    }
    records.forEach((r: PayrollRecord) => {
      const net = r.netSalary
      if (net < 20000) buckets['0-20K']++
      else if (net < 40000) buckets['20-40K']++
      else if (net < 60000) buckets['40-60K']++
      else if (net < 80000) buckets['60-80K']++
      else buckets['80K+']++
    })
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }))
  })()

  const barColors = ['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669']

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex items-center justify-between flex-wrap gap-4" {...fadeUp}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Monthly salary processing and approvals
            {summary.month ? ` — ${summary.month}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              exportToCSV(records.map((r: PayrollRecord) => ({
                code: r.employeeCode,
                name: r.name,
                email: r.email,
                baseSalary: r.baseSalary,
                daysPresent: r.daysPresent,
                daysAbsent: r.daysAbsent,
                overtimeHours : r.overtimeHours ,
                overtimePay: r.overtimePay,
                deductions: r.deductions,
                grossSalary: r.grossSalary,
                netSalary: r.netSalary,
                status: getStatus(r),
              })), 'payroll-' + (summary.month || 'report'))
              toast.success('Payroll exported')
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={handleBulkApprove}
            disabled={pendingCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Approve All ({pendingCount})
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Wallet, label: 'Total Gross Pay', value: `${currency} ${(summary.totalGross || 0).toLocaleString()}`, color: 'bg-emerald-600', sub: `${summary.employeeCount || 0} cleaners` },
          { icon: TrendingDown, label: 'Total Deductions', value: `${currency} ${(summary.totalDeductions || 0).toLocaleString()}`, color: 'bg-red-500', sub: (summary.totalDeductions || 0) > 0 ? 'from absences' : 'no deductions' },
          { icon: Banknote, label: 'Total Net Pay', value: `${currency} ${(summary.totalNet || 0).toLocaleString()}`, color: 'bg-teal-600', sub: 'after adjustments' },
          { icon: BarChart3, label: 'Overtime Pay', value: `${currency} ${(summary.totalOvertime || 0).toLocaleString()}`, color: 'bg-cyan-600', sub: 'extra hours bonus' },
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

      {/* Distribution Chart */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Net Salary Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Cleaners" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {distributionData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={barColors [index % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div className="flex items-center gap-3 flex-wrap" {...fadeUp}>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cleaners by name, code, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} of {records.length} records
        </Badge>
      </motion.div>

      {/* Payroll Table */}
      <motion.div {...fadeUp}>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Code</TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={'name' as any}>Name</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">Breakdown</TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell"><SortableHeader col={'baseSalary' as any}>Base</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Present</TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Absent</TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">OT Pay</TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">Deductions</TableHead>
                      <TableHead className="text-xs font-semibold"><SortableHeader col={'netSalary' as any}>Net Salary</SortableHeader></TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                    {sortedPayroll.map((r, index) => {
                      const pStatus = getStatus(r)
                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className={`hover:bg-muted/40 transition-colors ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                        >
                          <TableCell className="font-mono text-xs font-medium">{r.employeeCode}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="w-24">
                              <SalaryBreakdownBar
                                base={r.baseSalary}
                                overtime={r.overtimePay}
                                deductions={r.deductions}
                                currency={currency}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {currency} {r.baseSalary.toLocaleString()}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {r.daysPresent}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className={`inline-flex items-center gap-1.5 text-sm ${r.daysAbsent > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                              {r.daysAbsent > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
                              {r.daysAbsent}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {r.overtimePay > 0 ? (
                              <span className="text-teal-600 dark:text-teal-400 font-medium">
                                +{currency} {r.overtimePay.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {r.deductions > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                -{currency} {r.deductions.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">{currency} {r.netSalary.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={payrollStatusColors [pStatus] || ''}>{pStatus}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {pStatus === 'pending' ? (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                                onClick={() => approveMut.mutate(r)}
                                disabled={approveMut.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                    </AnimatePresence>
                    {sortedPayroll.length === 0 && !isLoading && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12">
                          <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                          <p className="text-sm text-muted-foreground">No payroll records found</p>
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


