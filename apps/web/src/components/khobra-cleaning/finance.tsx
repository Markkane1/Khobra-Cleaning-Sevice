'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, subDays, isAfter, isBefore, differenceInDays } from 'date-fns'
import { Plus, Search, DollarSign, Receipt, CreditCard, TrendingUp, TrendingDown, Banknote, Building2, AlertTriangle, CheckCircle2, Download, FileText, Upload, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportToCSV } from '@/lib/csv-export'
import { useSortable } from '@/hooks/use-sort'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const invStatusColors : Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  issued: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600',
}

const payStatusColors : Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const methodIcons: Record<string, any> = {
  cash: Banknote,
  bank_transfer: Building2,
}

const methodColors : Record<string, string> = {
  cash: 'text-emerald-600',
  bank_transfer: 'text-teal-600',
}

const emptyPayment = { invoiceId: '', amount: 0, method: 'cash', referenceNo: '', notes: '' }

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

function AnimatedCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)
  const target = value

  useEffect(() => {
    const duration = 800
    const start = performance.now()
    const from = ref.current

    function step(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (target - from) * eased)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    ref.current = target
  }, [target])

  return <span>{prefix}{display.toLocaleString()}</span>
}

export function Finance() {
  const [tab, setTab] = useState('invoices')
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState(emptyPayment)
  const [invSearch, setInvSearch] = useState('')
  const [paySearch, setPaySearch] = useState('')
  const [invStatusFilter, setInvStatusFilter] = useState<string>('all')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [createInvOpen, setCreateInvOpen] = useState(false)
  const [invForm, setInvForm] = useState({ customerId: '', totalAmount: 500, status: 'issued', notes: '' })
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => fetch('/api/khobra-cleaning/invoices').then(r => r.json()),
  })

  const { data: payments = [], isLoading: payLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => fetch('/api/khobra-cleaning/payments').then(r => r.json()),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetch('/api/khobra-cleaning/customers').then(r => r.json()),
  })

  const createInvoiceMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Invoice created'); setCreateInvOpen(false); setInvForm({ customerId: '', totalAmount: 500, status: 'issued', notes: '' }) },
    onError: () => toast.error('Failed to create invoice'),
  })

  const payMut = useMutation({
    mutationFn: async (d: any) => {
      let proofUrl: string | undefined = undefined
      if (proofFile) {
        try {
          const fd = new FormData()
          fd.append('file', proofFile)
          const uploadRes = await fetch('/api/khobra-cleaning/upload', { method: 'POST', body: fd }).then(r => r.json())
          if (uploadRes.url) proofUrl = uploadRes.url
        } catch {
          toast.error('Failed to upload proof file')
        }
      }
      const payload = { ...d, ...(proofUrl ? { proofUrl } : {}) }
      return fetch('/api/khobra-cleaning/payments', { method: 'POST', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json())
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Payment recorded successfully'); setPayOpen(false); setPayForm(emptyPayment); setProofFile(null); setProofPreview(null) },
    onError: () => toast.error('Failed to record payment'),
  })

  // Summary calculations
  const totalRevenue = useMemo(() => invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.totalAmount, 0), [invoices])
  const outstanding = useMemo(() => invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled').reduce((s: number, i: any) => s + i.totalAmount - (i.paidAmount || 0), 0), [invoices])
  const totalPaid = useMemo(() => payments.filter((p: any) => p.status === 'verified').reduce((s: number, p: any) => s + p.amount, 0), [payments])
  const totalInvoices = useMemo(() => invoices.length, [invoices])
  const paidInvoices = useMemo(() => invoices.filter((i: any) => i.status === 'paid').length, [invoices])
  const collectionRate = useMemo(() => totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0, [totalInvoices, paidInvoices])

  // Revenue by last 7 days
  const revenueByDay = useMemo(() => {
    const days: { label: string; amount: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i)
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayLabel = format(day, 'EEE')
      const dayPayments = payments.filter((p: any) => p.status === 'verified' && format(parseISO(p.createdAt), 'yyyy-MM-dd') === dayStr)
      const dayRevenue = dayPayments.reduce((s: number, p: any) => s + p.amount, 0)
      days.push({ label: dayLabel, amount: dayRevenue })
    }
    return days
  }, [payments])

  const maxRevenue = useMemo(() => Math.max(...revenueByDay.map(d => d.amount), 1), [revenueByDay])

  // Aging Summary
  const agingSummary = useMemo(() => {
    const now = new Date()
    const buckets: { label: string; amount: number; color: string; daysRange: string }[] = [
      { label: 'Current', amount: 0, color: 'bg-emerald-500', daysRange: 'Not yet due' },
      { label: '1-30 Days', amount: 0, color: 'bg-yellow-500', daysRange: '1 to 30 days overdue' },
      { label: '31-60 Days', amount: 0, color: 'bg-orange-500', daysRange: '31 to 60 days overdue' },
      { label: '60+ Days', amount: 0, color: 'bg-red-500', daysRange: 'Over 60 days overdue' },
    ]

    invoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled').forEach((inv: any) => {
      const remaining = inv.totalAmount - (inv.paidAmount || 0)
      if (!inv.dueDate || !inv.issuedAt) {
        buckets[0].amount += remaining
        return
      }
      const due = parseISO(inv.dueDate)
      const overdueDays = differenceInDays(now, due)
      if (overdueDays <= 0) {
        buckets[0].amount += remaining
      } else if (overdueDays <= 30) {
        buckets[1].amount += remaining
      } else if (overdueDays <= 60) {
        buckets[2].amount += remaining
      } else {
        buckets[3].amount += remaining
      }
    })

    return buckets
  }, [invoices])

  const handleExport = () => {
    const exportData = invoices.map((i: any) => ({
      'Invoice No': i.invoiceNo || '',
      'Customer': i.booking?.customer?.user?.name || i.customer?.user?.name || '',
      'Total Amount': i.totalAmount || 0,
      'Paid Amount': i.paidAmount || 0,
      Status: i.status || '',
      'Issued At': i.issuedAt || '',
    }))
    exportToCSV(exportData, 'finance')
    toast.success('Exported')
  }

  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const handleDownloadPDF = async (invoiceId: string, invoiceNo: string) => {
    setPdfLoading(invoiceId)
    try {
      const res = await fetch(`/api/khobra-cleaning/invoice-pdf?id=${invoiceId}`)
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoiceNo}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`PDF downloaded: ${invoiceNo}`)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setPdfLoading(null)
    }
  }

  const selectedInvoice = invoices.find((i: any) => i.id === payForm.invoiceId)
  const invoiceBalance = selectedInvoice ? (selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0)) : 0

  const filteredInv = useMemo(() => invoices.filter((i: any) => {
    if (invStatusFilter !== 'all' && i.status !== invStatusFilter) return false
    if (!invSearch) return true
    const s = invSearch.toLowerCase()
    return i.invoiceNo?.toLowerCase().includes(s) || i.customer?.user?.name?.toLowerCase().includes(s)
  }), [invoices, invSearch, invStatusFilter])

  const { sorted: sortedInv, SortableHeader } = useSortable<any>(filteredInv, 'issuedAt')

  const filteredPay = useMemo(() => payments.filter((p: any) => {
    if (!paySearch) return true
    const s = paySearch.toLowerCase()
    return p.invoice?.invoiceNo?.toLowerCase().includes(s) || p.invoice?.customer?.user?.name?.toLowerCase().includes(s)
  }), [payments, paySearch])

  const fadeIn = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">Invoices, payments, and reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>

          <Dialog open={createInvOpen} onOpenChange={setCreateInvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Create Invoice</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Customer</Label>
                  <Select value={invForm.customerId} onValueChange={v => setInvForm({ ...invForm, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.user?.name || c.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Total Amount (AED)</Label><Input type="number" value={invForm.totalAmount} onChange={e => setInvForm({ ...invForm, totalAmount: Number(e.target.value) })} /></div>
                  <div className="grid gap-2"><Label>Status</Label>
                    <Select value={invForm.status} onValueChange={v => setInvForm({ ...invForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateInvOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createInvoiceMut.mutate(invForm)} disabled={!invForm.customerId || invForm.totalAmount <= 0}>Generate Invoice</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={payOpen} onOpenChange={(v) => { setPayOpen(v); if (!v) { setPayForm(emptyPayment); setProofFile(null); setProofPreview(null) } }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />Record Payment</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Invoice</Label>
                <Select value={payForm.invoiceId} onValueChange={v => setPayForm({ ...payForm, invoiceId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>{invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled').map((i: any) => <SelectItem key={i.id} value={i.id}>{i.invoiceNo} - {i.customer?.user?.name} (Balance: AED {(i.totalAmount - (i.paidAmount || 0)).toLocaleString()})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedInvoice && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total Invoice Amount</span>
                    <span>AED {selectedInvoice.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Already Paid</span>
                    <span className="text-emerald-600">AED {(selectedInvoice.paidAmount || 0).toLocaleString()}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Remaining Balance</span>
                    <span className="text-emerald-700 dark:text-emerald-400">AED {invoiceBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Amount (AED)</Label><Input type="number" value={payForm.amount || ''} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Method</Label>
                  <Select value={payForm.method} onValueChange={v => setPayForm({ ...payForm, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2"><Label>Reference No</Label><Input value={payForm.referenceNo} onChange={e => setPayForm({ ...payForm, referenceNo: e.target.value })} placeholder="Optional" /></div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></div>

              {/* Payment Proof Upload */}
              <div className="grid gap-2">
                <Label>Payment Proof</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('File too large. Max 5MB')
                      return
                    }
                    setProofFile(file)
                    if (file.type.startsWith('image/')) {
                      const reader = new FileReader()
                      reader.onload = (ev) => setProofPreview(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    } else {
                      setProofPreview(null)
                    }
                  }}
                />
                <div
                  className={`border-dashed border-2 rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : proofFile
                        ? 'border-emerald-500/40 hover:border-emerald-500/60'
                        : 'border-muted-foreground/25 hover:border-emerald-500/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (!file) return
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error('File too large. Max 5MB')
                      return
                    }
                    setProofFile(file)
                    if (file.type.startsWith('image/')) {
                      const reader = new FileReader()
                      reader.onload = (ev) => setProofPreview(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    } else {
                      setProofPreview(null)
                    }
                  }}
                >
                  {!proofFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Drop payment proof or click to browse</p>
                      <p className="text-xs text-muted-foreground/60">Supports: JPG, PNG, GIF, PDF (max 5MB)</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {proofPreview ? (
                        <img src={proofPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{proofFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-muted transition-colors "
                        onClick={(e) => { e.stopPropagation(); setProofFile(null); setProofPreview(null) }}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => payMut.mutate({ ...payForm, status: 'verified', receivedBy: 'Admin' })} disabled={!payForm.invoiceId || payForm.amount <= 0}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </div>
      </motion.div>

      {/* Invoice Status Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled'].map(s => (
          <motion.div key={s} layout>
            <Button
              variant={invStatusFilter === s ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-7 ${invStatusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setInvStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div {...fadeIn}>
          <Card className="border-0 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold"><AnimatedCounter value={totalRevenue} prefix="AED " /></p>
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />{paidInvoices} paid invoices
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-transform hover:scale-110">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.1 }}>
          <Card className="border-0 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Outstanding</p>
                  <p className="text-2xl font-bold"><AnimatedCounter value={Math.round(outstanding)} prefix="AED " /></p>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />{totalInvoices - paidInvoices} unpaid invoices
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-200 dark:shadow-amber-900/30 transition-transform hover:scale-110">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.2 }}>
          <Card className="border-0 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-teal-600" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Payments Collected</p>
                  <p className="text-2xl font-bold"><AnimatedCounter value={totalPaid} prefix="AED " /></p>
                  <p className="text-xs text-teal-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />{payments.filter((p: any) => p.status === 'verified').length} verified payments
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-200 dark:shadow-teal-900/30 transition-transform hover:scale-110">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.3 }}>
          <Card className="border-0 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-600" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Collection Rate</p>
                  <p className="text-2xl font-bold"><AnimatedCounter value={collectionRate} prefix="" />%</p>
                  <p className="text-xs text-muted-foreground">{paidInvoices}/{totalInvoices} invoices</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-transform hover:scale-110">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Chart + Aging Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue Last 7 Days */}
        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.35 }} className="lg:col-span-3">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex items-end gap-2 h-32">
                {revenueByDay.map((day, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((day.amount / maxRevenue) * 100, 4)}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.08 }}
                      className={`w-full rounded-t-md min-h-[4px] ${day.amount > 0 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-muted'}`}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium">{day.label}</span>
                    {day.amount > 0 && (
                      <span className="text-[10px] text-muted-foreground">AED {(day.amount / 1000).toFixed(0)}k</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Aging Summary */}
        <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.4 }} className="lg:col-span-2">
          <Card className="border-0 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
            <CardHeader className="pb-2 pl-6 pr-5 pt-5">
              <CardTitle className="text-sm font-semibold">Aging Summary</CardTitle>
            </CardHeader>
            <CardContent className="pl-6 pr-5 pb-5 space-y-3">
              {agingSummary.map((bucket, idx) => (
                <motion.div
                  key={bucket.label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + idx * 0.1 }}
                  className="space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${bucket.color}`} />
                      <span className="text-xs font-medium">{bucket.label}</span>
                    </div>
                    <span className="text-xs font-semibold">AED {Math.round(bucket.amount).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${outstanding > 0 ? (bucket.amount / outstanding) * 100 : 0}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + idx * 0.1 }}
                      className={`h-full rounded-full ${bucket.color}`}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{bucket.daysRange}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="pl-9" />
          </div>
          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            {invLoading ? <div className="p-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
              <div className="max-h-[440px] overflow-y-auto">
                <Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold">Invoice</TableHead>
                  <TableHead className="text-xs font-semibold">Customer</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell"><SortableHeader col={'issuedAt' as any}>Issued</SortableHeader></TableHead>
                  <TableHead className="text-xs font-semibold"><SortableHeader col={'totalAmount' as any}>Total</SortableHeader></TableHead>
                  <TableHead className="text-xs font-semibold hidden sm:table-cell">Payment</TableHead>
                  <TableHead className="text-xs font-semibold"><SortableHeader col={'status' as any}>Status</SortableHeader></TableHead>
                  <TableHead className="text-xs font-semibold">PDF</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedInv.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">No invoices found</p>
                      </div>
                    </TableCell></TableRow>
                  ) : (
                    <AnimatePresence>
                    {sortedInv.map((inv: any, idx: number) => {
                    const pct = inv.totalAmount > 0 ? Math.round(((inv.paidAmount || 0) / inv.totalAmount) * 100) : 0
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`border-b border-border/40 ${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                      >
                        <TableCell className="font-mono text-xs font-medium">{inv.invoiceNo}</TableCell>
                        <TableCell className="font-medium">{inv.customer?.user?.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{inv.issuedAt ? format(parseISO(inv.issuedAt), 'MMM dd, yyyy') : '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-semibold text-sm">AED {inv.totalAmount.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="space-y-1 max-w-[120px]">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{pct}%</span>
                              <span>AED {(inv.paidAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.05 }}
                                className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-muted'}`}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={`${invStatusColors [inv.status] || ''} text-xs`}>{inv.status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadPDF(inv.id, inv.invoiceNo)} disabled={pdfLoading === inv.id}>
                            {pdfLoading === inv.id ? <span className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <FileText className="h-3.5 w-3.5 text-emerald-600" />}
                          </Button>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                    </AnimatePresence>
                  )}
                </TableBody></Table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search payments..." value={paySearch} onChange={e => setPaySearch(e.target.value)} className="pl-9" />
          </div>
          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            {payLoading ? <div className="p-6 space-y-4"><Skeleton className="h-10 w-full" /></div> : (
              <div className="max-h-[440px] overflow-y-auto">
                <Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold">Amount</TableHead>
                  <TableHead className="text-xs font-semibold">Method</TableHead>
                  <TableHead className="text-xs font-semibold">Invoice</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">Reference</TableHead>
                  <TableHead className="text-xs font-semibold">Proof</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredPay.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">No payments found</p>
                      </div>
                    </TableCell></TableRow>
                  ) : (
                    <AnimatePresence>
                    {filteredPay.map((p: any, idx: number) => {
                    const MethodIcon = methodIcons[p.method] || CreditCard
                    return (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`border-b border-border/40 ${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                      >
                        <TableCell className="font-semibold">AED {p.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MethodIcon className={`h-3.5 w-3.5 ${methodColors [p.method] || 'text-muted-foreground'}`} />
                            <span className="text-xs capitalize">{p.method.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.invoice?.invoiceNo}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.referenceNo || '-'}</TableCell>
                        <TableCell>
                          {p.proofUrl ? (
                            <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                              {p.proofUrl.match(/\.pdf$/i) ? (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors ">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ) : (
                                <img src={p.proofUrl} alt="Proof" className="w-10 h-10 rounded-lg object-cover hover:opacity-80 transition-opacity" />
                              )}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(parseISO(p.createdAt), 'MMM dd, yyyy')}</TableCell>
                        <TableCell><Badge className={`${payStatusColors [p.status] || ''} text-xs`}>{p.status}</Badge></TableCell>
                      </motion.tr>
                    )
                  })}
                    </AnimatePresence>
                  )}
                </TableBody></Table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


