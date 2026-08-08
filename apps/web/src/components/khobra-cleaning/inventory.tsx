'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Package, Download, Trash2, Edit2, AlertTriangle, DollarSign,
  TrendingDown, ShoppingCart, ArrowUpRight, ArrowDownRight, Phone, Mail, MapPin, Search, Grid, List, RefreshCw, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTenantCurrency } from '@/hooks/use-tenant-currency'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { exportToCSV } from '@/lib/csv-export'

const emptyItem = { name: '', sku: '', category: '', unit: 'pcs', currentStock: 0, minStock: 0, costPrice: 0, sellPrice: 0 }
const emptyVendor = { name: '', contactPerson: '', phone: '', email: '', address: '' }

const categoryColors : Record<string, string> = {
  Chemicals: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Tools: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  Supplies: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  PPE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

export function Inventory() {
  const currency = useTenantCurrency()
  const [tab, setTab] = useState('items')
  const [itemOpen, setItemOpen] = useState(false)
  const [vendorOpen, setVendorOpen] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [vForm, setVForm] = useState(emptyVendor)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [vendorEditId, setVendorEditId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: items = [], isLoading: itemLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => fetch('/api/khobra-cleaning/inventory').then(r => r.json()),
  })

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const [adjustForm, setAdjustForm] = useState({ adjustQuantity: 1, adjustType: 'IN', notes: '' })

  const { data: vendors = [], isLoading: venLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => fetch('/api/khobra-cleaning/vendors').then(r => r.json()),
  })

  const createItemMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/inventory', { method: 'POST', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item added'); setItemOpen(false); setForm(emptyItem) },
    onError: () => toast.error('Failed'),
  })

  const updateItemMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/inventory', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item updated'); setItemOpen(false); setForm(emptyItem); setEditId(null) },
    onError: () => toast.error('Failed'),
  })

  const adjustStockMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/inventory', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Stock adjusted'); setAdjustOpen(false); setAdjustItem(null) },
    onError: () => toast.error('Failed to adjust stock'),
  })

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/inventory?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item deleted') },
    onError: () => toast.error('Failed'),
  })

  const createVendorMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/vendors', { method: 'POST', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor added'); setVendorOpen(false); setVForm(emptyVendor) },
    onError: () => toast.error('Failed'),
  })

  const updateVendorMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/vendors', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor updated'); setVendorOpen(false); setVForm(emptyVendor); setVendorEditId(null) },
    onError: () => toast.error('Failed'),
  })

  const deleteVendorMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/vendors?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor removed') },
    onError: () => toast.error('Failed'),
  })

  const handleItemSubmit = () => {
    if (editId) updateItemMut.mutate({ id: editId, ...form })
    else createItemMut.mutate(form)
  }

  const handleItemEdit = (item: any) => {
    setForm({ name: item.name, sku: item.sku || '', category: item.category || '', unit: item.unit, currentStock: item.currentStock, minStock: item.minStock, costPrice: item.costPrice, sellPrice: item.sellPrice })
    setEditId(item.id); setItemOpen(true)
  }

  const lowStockCount = items.filter((i: any) => i.currentStock <= i.minStock).length
  const totalValue = items.reduce((s: number, i: any) => s + i.currentStock * i.costPrice, 0)
  const totalRetailValue = items.reduce((s: number, i: any) => s + i.currentStock * i.sellPrice, 0)
  const categories: Record<string, number> = {}
  items.forEach((i: any) => { if (i.category) { const k = i.category as string; categories[k] = (categories[k] || 0) + 1 } })
  const maxCategory = Math.max(...Object.values(categories), 1)

  const filteredItems = items.filter((i: any) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return i.name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s) || i.category?.toLowerCase().includes(s)
  })

  const handleExportItems = () => {
    exportToCSV(items, 'inventory-items', [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Category' },
      { key: 'currentStock', label: 'Current Stock' },
      { key: 'minStock', label: 'Min Stock' },
      { key: 'costPrice', label: 'Cost Price' },
      { key: 'sellPrice', label: 'Sell Price' },
      { key: 'unit', label: 'Unit' },
    ])
    toast.success('Items exported')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock management and vendor relations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportItems}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
          <Dialog open={vendorOpen} onOpenChange={(v) => { setVendorOpen(v); if (!v) { setVForm(emptyVendor); setVendorEditId(null) } }}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1.5" />Vendor</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{vendorEditId ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Company Name</Label><Input value={vForm.name} onChange={e => setVForm({ ...vForm, name: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Contact Person</Label><Input value={vForm.contactPerson} onChange={e => setVForm({ ...vForm, contactPerson: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Phone</Label><Input value={vForm.phone} onChange={e => setVForm({ ...vForm, phone: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" value={vForm.email} onChange={e => setVForm({ ...vForm, email: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Address</Label><Input value={vForm.address} onChange={e => setVForm({ ...vForm, address: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVendorOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => vendorEditId ? updateVendorMut.mutate({ id: vendorEditId, ...vForm }) : createVendorMut.mutate(vForm)} disabled={!vForm.name}>{vendorEditId ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={itemOpen} onOpenChange={(v) => { setItemOpen(v); if (!v) { setForm(emptyItem); setEditId(null) } }}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700" size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Item</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{editId ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="Chemicals">Chemicals</SelectItem><SelectItem value="Tools">Tools</SelectItem><SelectItem value="Supplies">Supplies</SelectItem><SelectItem value="PPE">PPE</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Unit</Label>
                    <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="pcs">Pieces</SelectItem><SelectItem value="litre">Litres</SelectItem><SelectItem value="pack">Packs</SelectItem><SelectItem value="pair">Pairs</SelectItem><SelectItem value="can">Cans</SelectItem><SelectItem value="kg">Kilograms</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Current Stock</Label><Input type="number" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: Number(e.target.value) })} /></div>
                  <div className="grid gap-2"><Label>Min Stock (Alert)</Label><Input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Cost Price ({currency})</Label><Input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: Number(e.target.value) })} /></div>
                  <div className="grid gap-2"><Label>Sell Price ({currency})</Label><Input type="number" value={form.sellPrice} onChange={e => setForm({ ...form, sellPrice: Number(e.target.value) })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setItemOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleItemSubmit} disabled={!form.name}>{editId ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Package, label: 'Total Items', value: items.length, color: 'bg-emerald-600', sub: `${Object.keys(categories).length} categories` },
          { icon: AlertTriangle, label: 'Low Stock', value: lowStockCount, color: lowStockCount > 0 ? 'bg-amber-500' : 'bg-emerald-600', sub: lowStockCount > 0 ? 'Needs reorder' : 'All stocked', pulse: lowStockCount > 0 },
          { icon: DollarSign, label: 'Stock Value', value: `${currency} ${totalValue.toLocaleString()}`, color: 'bg-teal-600', sub: `Cost basis` },
          { icon: TrendingDown, label: 'Retail Value', value: `${currency} ${totalRetailValue.toLocaleString()}`, color: 'bg-cyan-600', sub: `Margin: ${currency} ${(totalRetailValue - totalValue).toLocaleString()}` },
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

      {/* Category Distribution */}
      {Object.keys(categories).length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Category Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                  const pct = (count / maxCategory) * 100
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{cat}</span>
                      <div className="flex-1 h-5 rounded-full bg-muted/60 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${cat === 'Chemicals' ? 'bg-gradient-to-r from-orange-400 to-orange-500' : cat === 'Tools' ? 'bg-gradient-to-r from-slate-400 to-slate-500' : cat === 'PPE' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-cyan-400 to-cyan-500'}`}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.3 }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 max-w-xs">
          <TabsTrigger value="items"><Package className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Items ({items.length})</TabsTrigger>
          <TabsTrigger value="vendors"><ShoppingCart className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Vendors ({vendors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4 space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', ...Object.keys(categories)].map(cat => (
                <Button
                  key={cat} variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm" className="text-xs h-7 capitalize"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'All' : cat}
                </Button>
              ))}
            </div>
          </div>

          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            {itemLoading ? <div className="p-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table><TableHeader><TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">SKU</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Cost</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Sell</TableHead>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredItems.map((item: any, idx: number) => {
                      const isLow = item.currentStock <= item.minStock
                      const maxStock = Math.max(item.currentStock * 2, item.minStock * 3, 100)
                      const stockPct = Math.min((item.currentStock / maxStock) * 100, 100)
                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`border-b border-border/40 transition-colors hover:bg-muted/40 ${isLow ? 'bg-amber-50/50 dark:bg-amber-950/10' : idx % 2 === 1 ? 'bg-muted/20' : ''}`}
                        >
                          <TableCell className="font-medium py-3">
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            <span className="truncate max-w-[140px]">{item.name}</span>
                          </div>
                        </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{item.sku || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className={`text-[10px] ${categoryColors [item.category] || ''}`}>{item.category || '-'}</Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="min-w-[100px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-semibold tabular-nums ${isLow ? 'text-amber-600' : ''}`}>{item.currentStock}</span>
                                <span className="text-[10px] text-muted-foreground">min: {item.minStock}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-amber-400' : stockPct > 50 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm tabular-nums">{currency} {item.costPrice.toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm tabular-nums font-medium">{currency} {item.sellPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" aria-label={`Edit ${item.name}`} className="h-7 w-7" onClick={() => handleItemEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Delete ${item.name}`} className="h-7 w-7 text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Item</AlertDialogTitle><AlertDialogDescription>Permanently remove this inventory item?</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteItemMut.mutate(item.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </div>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </TableBody></Table>
                {filteredItems.length === 0 && !itemLoading && (
                  <div className="py-12 text-center">
                    <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No items found</p>
                  </div>
                )}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {venLoading ? Array.from({ length: 2 }).map((_, i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)
            : vendors.map((v: any, idx: number) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                  <CardContent className="p-5 pl-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <ShoppingCart className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{v.name}</p>
                            <p className="text-xs text-muted-foreground">{v.contactPerson}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${v.name}`} className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                          setVForm({ name: v.name || '', contactPerson: v.contactPerson || '', phone: v.phone || '', email: v.email || '', address: v.address || '' })
                          setVendorEditId(v.id)
                          setVendorOpen(true)
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Remove ${v.name}`} className="text-red-500 h-7 w-7 hover:bg-red-50 dark:hover:bg-red-950/20"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Vendor</AlertDialogTitle><AlertDialogDescription>Remove this vendor?</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteVendorMut.mutate(v.id)}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {v.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" /><span>{v.phone}</span>
                        </div>
                      )}
                      {v.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" /><span>{v.email}</span>
                        </div>
                      )}
                      {v.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" /><span className="truncate">{v.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {vendors.length === 0 && !venLoading && (
              <div className="col-span-2 py-12 text-center">
                <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No vendors yet. Add your firs t vendor.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

