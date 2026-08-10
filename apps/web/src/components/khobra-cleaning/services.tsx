'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, Download, LayoutGrid, List, Sparkles, Tag, TrendingUp, Eye, Upload, Image as ImageIcon, X, Cloud, Check, FolderPlus, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { useSortable } from '@/hooks/use-sort'
import { exportToCSV } from '@/lib/csv-export'
import { useTenantCurrency } from '@/hooks/use-tenant-currency'
import { apiRequest } from '@/lib/api-client'
import { CreateServiceSchema, UpdateServiceSchema } from '@repo/core'

export type ServiceCategory = {
  id: string
  name: string
  description?: string
  color?: string
}

export type Service = {
  id: string
  name: string
  description: string
  baseRate: number
  withMaterialsRate: number
  minDuration: number
  category: string
  skills: string
  status: string
  galleryImages?: string[]
  heroImages?: string[]
  materials?: ServiceMaterial[]
  createdAt: string
}

type ServiceMaterial = { inventoryItemId: string; quantityPerCleanerHour: number; unit: string; inventoryItem?: { id: string; name: string; unit: string; currentStock: number } }
type InventoryItem = { id: string; name: string; unit: string; currentStock: number }

const catStyles: Record<string, { border: string; bg: string; pill: string }> = {
  Cleaning:    { border: 'border-l-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  Specialized: { border: 'border-l-teal-400',    bg: 'bg-teal-50 dark:bg-teal-950/30',    pill: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
  Commercial:  { border: 'border-l-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',   pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
}

const defaultCatStyle = { border: 'border-l-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' }

const skillColors = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
]

const emptyForm = {
  name: '',
  description: '',
  baseRate: 150,
  withMaterialsRate: 180,
  minDuration: 2,
  category: 'Cleaning',
  skills: '',
  galleryImages: [] as string[],
  heroImages: [] as string[],
  materials: [] as ServiceMaterial[],
}

export function Services() {
  const currency = useTenantCurrency()
  const [open, setOpen] = useState(false)
  const [catManagerOpen, setCatManagerOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [imageModal, setImageModal] = useState<'galleryImages' | 'heroImages' | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Category Form State
  const [catForm, setCatForm] = useState({ id: '', name: '', description: '', color: 'emerald' })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)

  const qc = useQueryClient()

  // Fetch Services
  const { data: items = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => apiRequest<Service[]>('/api/khobra-cleaning/services'),
  })

  // Fetch Dynamic Categories
  const { data: dbCategories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: () => apiRequest<ServiceCategory[]>('/api/khobra-cleaning/services/categories'),
  })
  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiRequest<InventoryItem[]>('/api/khobra-cleaning/inventory'),
  })

  // Service Mutations
  const createMut = useMutation({
    mutationFn: (d: typeof emptyForm) =>
      apiRequest('/api/khobra-cleaning/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast.success('Service created')
      setOpen(false)
      setForm(emptyForm)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to create service'),
  })

  const updateMut = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      apiRequest('/api/khobra-cleaning/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast.success('Service updated')
      setOpen(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update service'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/khobra-cleaning/services?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      toast.success('Service deleted')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to delete service'),
  })

  // Category Mutations
  const saveCatMut = useMutation({
    mutationFn: (d: typeof catForm) =>
      apiRequest('/api/khobra-cleaning/services/categories', {
        method: editingCatId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories'] })
      toast.success(editingCatId ? 'Category updated' : 'New category created')
      setCatForm({ id: '', name: '', description: '', color: 'emerald' })
      setEditingCatId(null)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to save category'),
  })

  const deleteCatMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/khobra-cleaning/services/categories?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories'] })
      toast.success('Category deleted')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to delete category'),
  })

  const handleFileUpload = async (kind: 'galleryImages' | 'heroImages', e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = Array.from(input.files || [])
    if (files.length === 0) return

    setIsUploading(true)
    try {
      const newImageUrls = await Promise.all(files.map(async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', kind === 'galleryImages' ? 'service-gallery' : 'service-hero')

        const res = await fetch('/api/khobra-cleaning/upload', {
          method: 'POST',
          body: fd,
        })
        const data = await res.json()
        if (!res.ok || !data.url) throw new Error(data.error || 'Cloudinary upload failed.')
        return data.url as string
      }))

      setForm(prev => ({ ...prev, [kind]: [...prev[kind], ...newImageUrls] }))
      toast.success(`${newImageUrls.length} image(s) uploaded to Cloudinary.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cloudinary upload failed.')
    } finally {
      setIsUploading(false)
      input.value = ''
    }
  }

  // Remove Image
  const handleRemoveImage = (kind: 'galleryImages' | 'heroImages', index: number) => {
    setForm(prev => ({ ...prev, [kind]: prev[kind].filter((_, i) => i !== index) }))
  }

  const handleSubmit = () => {
    const result = editId ? UpdateServiceSchema.safeParse({ id: editId, ...form }) : CreateServiceSchema.safeParse(form)
    if (!result.success) return
    if (editId) {
      updateMut.mutate({ id: editId, ...form })
    } else {
      createMut.mutate(form)
    }
  }

  const serviceValidation = editId ? UpdateServiceSchema.safeParse({ id: editId, ...form }) : CreateServiceSchema.safeParse(form)
  const serviceSaveError = createMut.error || updateMut.error

  const handleEdit = (s: Service) => {
    setEditId(s.id)
    setForm({
      name: s.name,
      description: s.description || '',
      baseRate: s.baseRate,
      withMaterialsRate: s.withMaterialsRate,
      minDuration: s.minDuration,
      category: s.category || (dbCategories[0]?.name || 'Cleaning'),
      skills: s.skills || '',
      galleryImages: s.galleryImages || [],
      heroImages: s.heroImages || [],
      materials: (s.materials || []).map(material => ({ inventoryItemId: material.inventoryItemId, quantityPerCleanerHour: material.quantityPerCleanerHour, unit: material.unit })),
    })
    setOpen(true)
  }

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>()
    dbCategories.forEach(c => cats.add(c.name))
    items.forEach((s: Service) => { if (s.category) cats.add(s.category) })
    return Array.from(cats).sort()
  }, [items, dbCategories])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { total: items.length, active: 0, inactive: 0 }
    items.forEach((s: Service) => {
      if (s.status === 'active') counts.active++
      else if (s.status === 'inactive') counts.inactive++
    })
    return counts
  }, [items])

  const stats = useMemo(() => {
    if (items.length === 0) return { total: 0, active: 0, avgRate: 0, categories: uniqueCategories.length }
    const totalRate = items.reduce((acc, curr) => acc + (curr.baseRate || 0), 0)
    return {
      total: items.length,
      active: statusCounts.active,
      avgRate: Math.round(totalRate / items.length),
      categories: uniqueCategories.length,
    }
  }, [items, statusCounts, uniqueCategories])

  const filtered = useMemo(() => {
    return items.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
        (s.skills && s.skills.toLowerCase().includes(search.toLowerCase()))
      const matchCat = catFilter === 'All' || s.category === catFilter
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      return matchSearch && matchCat && matchStatus
    })
  }, [items, search, catFilter, statusFilter])

  const { sorted } = useSortable<Service>(filtered)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
            <p className="text-sm text-muted-foreground">Manage service offerings, dynamic categories, images, and material supplies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-teal-300 text-teal-700" onClick={() => setCatManagerOpen(true)}>
              <FolderPlus className="h-4 w-4" />Manage Categories ({uniqueCategories.length})
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9" onClick={() => { exportToCSV(filtered as unknown as Record<string, unknown>[], 'services'); toast.success('CSV downloaded') }}>
                  <Download className="h-4 w-4 mr-1.5" />CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export filtered services to CSV</TooltipContent>
            </Tooltip>

            {/* Add / Edit Service Modal */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); setImageModal(null) } }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" />Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editId ? 'Edit Service' : 'Add New Service'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-3 text-xs">
                  {/* Basic Service Info */}
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold">Service Name *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Deep Villa Cleaning" className="h-9" />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detailed service scope, guidelines, and benefits..." rows={3} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold">Without Materials ({currency}/hr) *</Label>
                      <Input type="number" value={form.baseRate} onChange={e => setForm({ ...form, baseRate: Number(e.target.value) })} className="h-9" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold">With Materials ({currency}/hr) *</Label>
                      <Input type="number" value={form.withMaterialsRate} onChange={e => setForm({ ...form, withMaterialsRate: Number(e.target.value) })} className="h-9" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold">Minimum Booking Duration</Label>
                      <Input value="2 hours (all services)" readOnly className="h-9 bg-muted" />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-xs font-semibold">Material bill of materials</Label>
                        <p className="text-[11px] text-muted-foreground">Internal expected usage per cleaner-hour. This does not change the customer price.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, materials: [...form.materials, { inventoryItemId: inventory[0]?.id || '', quantityPerCleanerHour: 1, unit: inventory[0]?.unit || 'pcs' }] })} disabled={!inventory.length}>Add item</Button>
                    </div>
                    {form.materials.map((material, index) => (
                      <div key={`${material.inventoryItemId}-${index}`} className="grid grid-cols-[1fr_110px_72px_32px] gap-2 items-center">
                        <Select value={material.inventoryItemId} onValueChange={inventoryItemId => {
                          const item = inventory.find(candidate => candidate.id === inventoryItemId)
                          setForm({ ...form, materials: form.materials.map((candidate, i) => i === index ? { ...candidate, inventoryItemId, unit: item?.unit || candidate.unit } : candidate) })
                        }}><SelectTrigger className="h-9"><SelectValue placeholder="Inventory item" /></SelectTrigger><SelectContent>{inventory.map(item => <SelectItem key={item.id} value={item.id}>{item.name} ({item.currentStock} {item.unit})</SelectItem>)}</SelectContent></Select>
                        <Input className="h-9" type="number" min="0.01" step="0.01" value={material.quantityPerCleanerHour} onChange={event => setForm({ ...form, materials: form.materials.map((candidate, i) => i === index ? { ...candidate, quantityPerCleanerHour: Number(event.target.value) } : candidate) })} aria-label="Quantity per cleaner hour" />
                        <Input className="h-9" value={material.unit} onChange={event => setForm({ ...form, materials: form.materials.map((candidate, i) => i === index ? { ...candidate, unit: event.target.value } : candidate) })} aria-label="Unit" />
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setForm({ ...form, materials: form.materials.filter((_, i) => i !== index) })} aria-label="Remove material"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic Category Selection */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Service Category *</Label>
                      <button type="button" onClick={() => setCatManagerOpen(true)} className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1">
                        <Plus className="h-3 w-3" />Add / Manage Categories
                      </button>
                    </div>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select category..." /></SelectTrigger>
                      <SelectContent>
                        {uniqueCategories.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-emerald-600" />
                        Service Images
                      </Label>
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                        <Cloud className="h-3 w-3 mr-1" />Cloudinary CDN
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        { kind: 'galleryImages' as const, title: 'Service Gallery', detail: 'Photos shown in the service gallery' },
                        { kind: 'heroImages' as const, title: 'Hero Images', detail: 'Wide images used for service banners' },
                      ]).map(({ kind, title, detail }) => (
                        <button key={kind} type="button" onClick={() => setImageModal(kind)} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
                          {form[kind][0] ? <img src={form[kind][0]} alt="" className="h-12 w-16 rounded-md object-cover" /> : <span className="flex h-12 w-16 items-center justify-center rounded-md bg-muted"><ImageIcon className="h-5 w-5 text-muted-foreground" /></span>}
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{title}</span><span className="block text-[10px] text-muted-foreground">{detail}</span></span>
                          <Badge variant="secondary" className="text-[10px]">{form[kind].length}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Skill tags (informational only)</Label>
                    <Input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="deep_cleaning, bathroom, kitchen" className="h-9" />
                  </div>
                </div>

                <DialogFooter>
                  {(serviceSaveError || (form.name && !serviceValidation.success)) && <p className="text-sm text-destructive sm:mr-auto" role="alert">{serviceSaveError instanceof Error ? serviceSaveError.message : !serviceValidation.success ? serviceValidation.error.issues[0]?.message : ''}</p>}
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={!serviceValidation.success || createMut.isPending || updateMut.isPending || isUploading}>
                    {editId ? 'Update Service' : 'Create Service'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={imageModal !== null} onOpenChange={(v) => { if (!v && !isUploading) setImageModal(null) }}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{imageModal === 'heroImages' ? 'Upload Hero Images' : 'Upload Service Gallery Images'}</DialogTitle>
                </DialogHeader>
                {imageModal && (
                  <div className="space-y-4 py-2">
                    <p className="text-xs text-muted-foreground">
                      {imageModal === 'heroImages' ? 'Upload wide banner images for this service.' : 'Upload customer-facing photos for this service gallery.'}
                    </p>

                    {form[imageModal].length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-3">
                        {form[imageModal].map((url, index) => (
                          <div key={url} className="relative overflow-hidden rounded-lg border bg-muted aspect-video">
                            <img src={url} alt={`${imageModal === 'heroImages' ? 'Hero' : 'Gallery'} image ${index + 1}`} className="h-full w-full object-cover" />
                            <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => handleRemoveImage(imageModal, index)} className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1 text-white shadow">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label aria-busy={isUploading} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center transition-colors hover:bg-emerald-50">
                      <Upload className="mb-2 h-7 w-7 text-emerald-600" />
                      <span className="text-sm font-semibold">{isUploading ? 'Uploading to Cloudinary…' : 'Choose image files'}</span>
                      <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP · max 5MB each</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => handleFileUpload(imageModal, e)} className="hidden" disabled={isUploading} />
                    </label>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" onClick={() => setImageModal(null)} disabled={isUploading}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dynamic Category Management CRUD Modal */}
            <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FolderPlus className="h-5 w-5 text-emerald-600" />
                    Category Management CRUD
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Create / Edit Category Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!catForm.name) return
                      saveCatMut.mutate(catForm)
                    }}
                    className="p-3 rounded-lg bg-muted/40 border space-y-3"
                  >
                    <h3 className="font-bold text-xs">{editingCatId ? 'Edit Category' : 'Create New Category'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Category Name *</Label>
                        <Input
                          placeholder="e.g. Residential Cleaning"
                          value={catForm.name}
                          onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Badge Theme</Label>
                        <Select value={catForm.color} onValueChange={v => setCatForm({ ...catForm, color: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="emerald">Emerald Green</SelectItem>
                            <SelectItem value="teal">Teal Cyan</SelectItem>
                            <SelectItem value="amber">Amber Gold</SelectItem>
                            <SelectItem value="violet">Violet Purple</SelectItem>
                            <SelectItem value="rose">Rose Red</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="Brief scope of services in this category..."
                        value={catForm.description}
                        onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      {editingCatId && (
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingCatId(null); setCatForm({ id: '', name: '', description: '', color: 'emerald' }) }}>
                          Cancel
                        </Button>
                      )}
                      <Button type="submit" size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs gap-1">
                        {editingCatId ? 'Save Changes' : 'Create Category'}
                      </Button>
                    </div>
                  </form>

                  {/* Categories Audit Table */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Active Categories ({dbCategories.length})</Label>
                    <div className="max-h-[250px] overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Category Name</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-right text-xs">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dbCategories.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-semibold text-xs">{c.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{c.description || 'Service Category'}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-emerald-600"
                                  onClick={() => {
                                    setEditingCatId(c.id)
                                    setCatForm({ id: c.id, name: c.name, description: c.description || '', color: c.color || 'emerald' })
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-red-500 hover:text-red-700"
                                  onClick={() => deleteCatMut.mutate(c.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCatManagerOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Stats */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Services', value: stats.total, icon: Sparkles, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
              { label: 'Active Services', value: stats.active, icon: TrendingUp, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50' },
              { label: 'Avg Hourly Rate', value: `${currency} ${stats.avgRate.toLocaleString()}`, icon: Tag, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
              { label: 'Categories', value: stats.categories, icon: FolderPlus, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50' },
            ].map((s, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold">{s.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search services or skills..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-9 text-xs w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <Button size="icon" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} className="h-9 w-9 rounded-none" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button size="icon" variant={viewMode === 'list' ? 'secondary' : 'ghost'} className="h-9 w-9 rounded-none" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Services Display Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((s: Service) => {
              const catStyle = catStyles[s.category] || defaultCatStyle
              const coverImage = s.heroImages?.[0] || s.galleryImages?.[0]
              return (
                <Card key={s.id} className={`border-0 shadow-sm border-l-4 ${catStyle.border} overflow-hidden hover:shadow-md transition-shadow`}>
                  {coverImage && (
                    <div className="h-36 w-full overflow-hidden bg-muted relative">
                      <img src={coverImage} alt={s.name} className="w-full h-full object-cover" />
                      <Badge className="absolute top-2 right-2 bg-black/60 text-white backdrop-blur-md text-[10px]">
                        {(s.galleryImages?.length || 0) + (s.heroImages?.length || 0)} Image(s)
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-base">{s.name}</h3>
                        <Badge className={`${catStyle.pill} mt-1 text-[10px]`}>{s.category || 'General'}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{currency} {s.baseRate}/hr <span className="font-normal text-muted-foreground">without</span></p>
                        <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{currency} {s.withMaterialsRate}/hr <span className="font-normal text-muted-foreground">with materials</span></p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description || 'Professional cleaning service.'}</p>

                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Min Duration: {s.minDuration} hrs</span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Service</AlertDialogTitle>
                              <AlertDialogDescription>Delete {s.name}? This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(s.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Without Materials</TableHead>
                    <TableHead>With Materials</TableHead>
                    <TableHead>Min Duration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((s: Service) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{s.name}</TableCell>
                      <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                      <TableCell className="font-bold text-emerald-600">{currency} {s.baseRate}/hr</TableCell>
                      <TableCell className="font-bold text-teal-600">{currency} {s.withMaterialsRate}/hr</TableCell>
                      <TableCell>{s.minDuration} hrs</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} className="h-7 w-7" onClick={() => handleEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} className="h-7 w-7 text-red-500" onClick={() => deleteMut.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}
