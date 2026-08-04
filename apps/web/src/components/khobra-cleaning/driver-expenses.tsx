'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Fuel, Plus, ReceiptText, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const categories = ['petrol', 'repair', 'maintenance', 'toll', 'parking', 'other'] as const
const emptyForm = { tripId: '', category: 'petrol', typeDetail: '', amount: '', expenseDate: format(new Date(), 'yyyy-MM-dd'), notes: '' }
const statusColors: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-800' }

function BusinessExpenses() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: 'cleaning_material', description: '', amount: '', expenseDate: format(new Date(), 'yyyy-MM-dd'), notes: '' })
  const { data: expenses = [] } = useQuery<any[]>({ queryKey: ['business-expenses'], queryFn: () => fetch('/api/khobra-cleaning/business-expenses').then(response => response.json()) })
  const create = useMutation({
    mutationFn: () => fetch('/api/khobra-cleaning/business-expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-expenses'] }); setOpen(false); setForm({ category: 'cleaning_material', description: '', amount: '', expenseDate: format(new Date(), 'yyyy-MM-dd'), notes: '' }); toast.success('Expense recorded') },
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({ mutationFn: (id: string) => fetch(`/api/khobra-cleaning/business-expenses?id=${id}`, { method: 'DELETE' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['business-expenses'] }) })
  const total = (category: string) => expenses.filter(expense => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0)

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Business Expenses</h2><p className="text-sm text-muted-foreground">Cleaning materials, salaries and specified other costs.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Record Expense</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record Business Expense</DialogTitle></DialogHeader><div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4"><div><Label>Category</Label><Select value={form.category} onValueChange={category => setForm({ ...form, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cleaning_material">Cleaning Material</SelectItem><SelectItem value="salary">Salary</SelectItem><SelectItem value="other">Any Other</SelectItem></SelectContent></Select></div><div><Label>Date</Label><Input type="date" value={form.expenseDate} onChange={event => setForm({ ...form, expenseDate: event.target.value })} /></div></div>
      <div><Label>{form.category === 'other' ? 'Specify expense' : 'Description'}</Label><Input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder={form.category === 'other' ? 'Required expense type' : 'What was paid for?'} /></div>
      <div><Label>Amount (AED)</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.description.trim() || Number(form.amount) <= 0 || create.isPending} onClick={() => create.mutate()}>Save Expense</Button></DialogFooter></DialogContent></Dialog></div>
    <div className="grid grid-cols-3 gap-3">{[['cleaning_material', 'Cleaning Material'], ['salary', 'Salaries'], ['other', 'Any Other']].map(([category, label]) => <Card key={category}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">AED {total(category).toLocaleString()}</p></CardContent></Card>)}</div>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader><TableBody>{expenses.length ? expenses.map(expense => <TableRow key={expense.id}><TableCell>{format(new Date(expense.expenseDate), 'dd MMM yyyy')}</TableCell><TableCell className="capitalize">{expense.category.replace('_', ' ')}</TableCell><TableCell>{expense.description}</TableCell><TableCell className="font-semibold">{expense.currency} {expense.amount.toLocaleString()}</TableCell><TableCell>{expense.notes || '-'}</TableCell><TableCell><Button size="icon" variant="ghost" aria-label="Delete expense" onClick={() => { if (window.confirm('Delete this expense record?')) remove.mutate(expense.id) }}><Trash2 className="h-4 w-4 text-red-600" /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No business expenses recorded.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>
}

export function DriverExpenses() {
  const currentRole = useAppStore(state => state.currentRole)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data: expenses = [], isLoading } = useQuery<any[]>({ queryKey: ['driver-expenses'], queryFn: () => fetch('/api/khobra-cleaning/driver-expenses').then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body }) })
  const { data: trips = [] } = useQuery<any[]>({ queryKey: ['trips'], queryFn: () => fetch('/api/khobra-cleaning/trips').then(response => response.json()), enabled: currentRole === 'driver' })

  const createExpense = useMutation({
    mutationFn: () => fetch('/api/khobra-cleaning/driver-expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, tripId: form.tripId || undefined, amount: Number(form.amount) }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-expenses'] }); setOpen(false); setForm(emptyForm); toast.success('Expense submitted for approval') },
    onError: (error: Error) => toast.error(error.message),
  })

  const decideExpense = useMutation({
    mutationFn: ({ id, decision, remarks }: { id: string; decision: 'approved' | 'rejected'; remarks?: string }) => fetch('/api/khobra-cleaning/driver-expenses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision, remarks }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-expenses'] }); toast.success('Expense decision recorded') },
    onError: (error: Error) => toast.error(error.message),
  })

  return <div className="space-y-6">
    {currentRole === 'admin' && <BusinessExpenses />}
    <div className="flex items-center justify-between gap-4"><div><h1 className={currentRole === 'admin' ? 'text-lg font-semibold' : 'text-2xl font-bold'}>{currentRole === 'admin' ? 'Driver Transport Expenses' : 'Driver Expenses'}</h1><p className="text-sm text-muted-foreground">Petrol, repairs, maintenance, tolls, parking and other transport costs.</p></div>{currentRole === 'driver' && <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />Add Expense</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add Driver Expense</DialogTitle></DialogHeader><div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Expense kind</Label><Select value={form.category} onValueChange={category => setForm({ ...form, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(category => <SelectItem key={category} value={category}>{category.replace(/^./, letter => letter.toUpperCase())}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Type / detail</Label><Input value={form.typeDetail} onChange={event => setForm({ ...form, typeDetail: event.target.value })} placeholder="Fuel grade, repair type..." /></div></div>
      <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Amount (AED)</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></div><div className="grid gap-2"><Label>Expense date</Label><Input type="date" value={form.expenseDate} onChange={event => setForm({ ...form, expenseDate: event.target.value })} /></div></div>
      <div className="grid gap-2"><Label>Related trip (optional)</Label><Select value={form.tripId || 'none'} onValueChange={tripId => setForm({ ...form, tripId: tripId === 'none' ? '' : tripId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No specific trip</SelectItem>{trips.map(trip => <SelectItem key={trip.id} value={trip.id}>{format(new Date(trip.date), 'dd MMM yyyy')} · {trip.status.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} maxLength={1000} placeholder="Expense details..." /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.amount || Number(form.amount) <= 0 || createExpense.isPending} onClick={() => createExpense.mutate()}>{createExpense.isPending ? 'Submitting...' : 'Submit Expense'}</Button></DialogFooter></DialogContent></Dialog>}</div>

    <div className="grid grid-cols-3 gap-3">{[{ label: 'Pending', status: 'pending', icon: ReceiptText }, { label: 'Approved', status: 'approved', icon: Fuel }, { label: 'Rejected', status: 'rejected', icon: Wrench }].map(item => <Card key={item.status}><CardContent className="p-4 flex items-center gap-3"><item.icon className="h-5 w-5 text-emerald-600" /><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-xl font-bold">{expenses.filter(expense => expense.status === item.status).length}</p></div></CardContent></Card>)}</div>

    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead>{currentRole === 'admin' && <TableHead>Driver</TableHead>}<TableHead>Kind</TableHead><TableHead>Details</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>{currentRole === 'admin' && <TableHead>Review</TableHead>}</TableRow></TableHeader><TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading expenses...</TableCell></TableRow> : expenses.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No driver expenses found.</TableCell></TableRow> : expenses.map(expense => <TableRow key={expense.id}><TableCell>{format(new Date(expense.expenseDate), 'dd MMM yyyy')}</TableCell>{currentRole === 'admin' && <TableCell>{expense.driver?.user?.name}</TableCell>}<TableCell className="capitalize">{expense.category}</TableCell><TableCell>{expense.typeDetail || expense.notes || '-'}</TableCell><TableCell className="font-semibold">{expense.currency} {expense.amount.toLocaleString()}</TableCell><TableCell><Badge className={statusColors[expense.status]}>{expense.status}</Badge></TableCell>{currentRole === 'admin' && <TableCell>{expense.status === 'pending' ? <div className="flex gap-2"><Button size="sm" onClick={() => decideExpense.mutate({ id: expense.id, decision: 'approved' })}>Approve</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => decideExpense.mutate({ id: expense.id, decision: 'rejected', remarks: window.prompt('Rejection reason (optional)') || undefined })}>Reject</Button></div> : <span className="text-xs text-muted-foreground">Reviewed</span>}</TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>
  </div>
}
