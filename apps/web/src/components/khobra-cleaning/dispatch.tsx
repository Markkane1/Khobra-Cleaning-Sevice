'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, startOfDay } from 'date-fns'
import { Truck, MapPin, Plus, Phone, Clock, CheckCircle2, Navigation, Fuel, Gauge, Users, CalendarCheck, Layers, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSortable } from '@/hooks/use-sort'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'

const tripStatusColors : Record<string, string> = {
  planned: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const emptyTrip = { driverId: '', date: '', notes: '', startMileage: 0, fuelCost: 0 }

export function Dispatch() {
  const currentRole = useAppStore(s => s.currentRole)
  const [tab, setTab] = useState('today')
  const [tripOpen, setTripOpen] = useState(false)
  const [tripForm, setTripForm] = useState(emptyTrip)
  const [driverOpen, setDriverOpen] = useState(false)
  const [driverEditId, setDriverEditId] = useState<string | null>(null)
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', email: '', licenseNo: '', vehicleNo: '' })
  const qc = useQueryClient()

  const { data: drivers = [], isLoading: drvLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => fetch('/api/khobra-cleaning/drivers').then(r => r.json()),
  })

  const { data: trips = [], isLoading: tripLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/khobra-cleaning/trips').then(r => r.json()),
  })

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => fetch('/api/khobra-cleaning/bookings').then(r => r.json()),
  })

  const createDriverMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success('Driver created'); setDriverOpen(false); setDriverForm({ name: '', phone: '', email: '', licenseNo: '', vehicleNo: '' }) },
    onError: () => toast.error('Failed to create driver'),
  })

  const updateDriverMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/drivers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success('Driver updated'); setDriverOpen(false); setDriverForm({ name: '', phone: '', email: '', licenseNo: '', vehicleNo: '' }); setDriverEditId(null) },
    onError: () => toast.error('Failed to update driver'),
  })

  const deleteDriverMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/drivers?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success('Driver removed') },
    onError: () => toast.error('Failed to remove driver'),
  })

  const deleteTripMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/khobra-cleaning/trips?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip deleted') },
    onError: () => toast.error('Failed to delete trip'),
  })

  const createTripMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip created successfully'); setTripOpen(false); setTripForm(emptyTrip) },
    onError: () => toast.error('Failed to create trip'),
  })

  const updateTripMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/trips', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip updated') },
    onError: () => toast.error('Failed to update trip'),
  })

  const updateBookingMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/bookings', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async r => {
      const body = await r.json()
      if (!r.ok) throw new Error(body.error || 'Failed to update booking status')
      return body
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); toast.success('Booking status updated') },
    onError: (error: Error) => toast.error(error.message),
  })

  // Today's bookings for kanban
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayBookings = useMemo(() => bookings.filter((b: any) => {
    const bDate = format(parseISO(b.scheduledDate), 'yyyy-MM-dd')
    return bDate === todayStr
  }), [bookings, todayStr])

  const kanbanColumns = useMemo(() => {
    return [
      {
        id: 'scheduled',
        title: 'Scheduled',
        icon: CalendarCheck,
        color: 'text-teal-500',
        bgColor: 'bg-teal-500',
        items: todayBookings.filter((b: any) => b.status === 'scheduled' || b.status === 'confirmed'),
      },
      {
        id: 'on_the_way',
        title: 'On the Way',
        icon: Truck,
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-500',
        items: todayBookings.filter((b: any) => b.status === 'on_the_way'),
      },
      {
        id: 'in_progress',
        title: 'In Progress',
        icon: Navigation,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500',
        items: todayBookings.filter((b: any) => b.status === 'in_progress'),
      },
      {
        id: 'completed',
        title: 'Completed',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500',
        items: todayBookings.filter((b: any) => b.status === 'completed'),
      },
    ]
  }, [todayBookings])

  // Trip summary stats
  const todayTrips = useMemo(() => trips.filter((t: any) => {
    const tDate = format(parseISO(t.date), 'yyyy-MM-dd')
    return tDate === todayStr
  }), [trips, todayStr])

  const tripStats = useMemo(() => ({
    total: todayTrips.length,
    inProgress: todayTrips.filter((t: any) => t.status === 'in_progress').length,
    completed: todayTrips.filter((t: any) => t.status === 'completed').length,
    planned: todayTrips.filter((t: any) => t.status === 'planned').length,
  }), [todayTrips])

  const upcomingStops = useMemo(() => trips.flatMap((trip: any) => {
    const tripDate = format(parseISO(trip.date), 'yyyy-MM-dd')
    if (tripDate < todayStr || trip.status === 'completed') return []
    return (trip.stops || []).filter((stop: any) => stop.status !== 'completed').map((stop: any) => ({ ...stop, tripDate, tripStatus: trip.status }))
  }), [trips, todayStr])

  // Driver stats
  const driverStats = useMemo(() => {
    return drivers.map((d: any) => {
      const driverTrips = trips.filter((t: any) => t.driverId === d.id)
      const totalMileage = driverTrips.reduce((s: number, t: any) => {
        if (t.startMileage && t.endMileage) return s + (t.endMileage - t.startMileage)
        return s
      }, 0)
      return { ...d, tripCount: driverTrips.length, totalMileage }
    })
  }, [drivers , trips])

  const tripsWithDriverName = useMemo(() => trips.map((t: any) => ({ ...t, driverName: t.driver?.user?.name || '' })), [trips])
  const { sorted: sortedTrips, SortableHeader } = useSortable(tripsWithDriverName, 'driverName')

  const handleKanbanMove = (bookingId: string, newStatus: string) => {
    if (newStatus === 'on_the_way' && !window.confirm('Confirm that you are now on the way to this booking?')) return
    updateBookingMut.mutate({ id: bookingId, status: newStatus })
  }

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35 },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">Driver management and trip scheduling</p>
        </div>
        <div className={currentRole === 'admin' ? 'flex gap-2' : 'hidden'}>
          <Dialog open={driverOpen} onOpenChange={(v) => { setDriverOpen(v); if (!v) { setDriverForm({ name: '', phone: '', email: '', licenseNo: '', vehicleNo: '' }); setDriverEditId(null) } }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Driver</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{driverEditId ? 'Edit Driver' : 'Add New Driver'}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Full Name</Label><Input value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} placeholder="Driver Name" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Phone</Label><Input value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="+971..." /></div>
                  <div className="grid gap-2"><Label>Email (optional)</Label><Input type="email" value={driverForm.email} onChange={e => setDriverForm({ ...driverForm, email: e.target.value })} placeholder="driver@khobra.ae" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>License No.</Label><Input value={driverForm.licenseNo} onChange={e => setDriverForm({ ...driverForm, licenseNo: e.target.value })} placeholder="LIC-12345" /></div>
                  <div className="grid gap-2"><Label>Vehicle No.</Label><Input value={driverForm.vehicleNo} onChange={e => setDriverForm({ ...driverForm, vehicleNo: e.target.value })} placeholder="UAE-5678" /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDriverOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => driverEditId ? updateDriverMut.mutate({ id: driverEditId, ...driverForm }) : createDriverMut.mutate(driverForm)} disabled={!driverForm.name}>{driverEditId ? 'Update' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={tripOpen} onOpenChange={(v) => { setTripOpen(v); if (!v) setTripForm(emptyTrip) }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" />New Trip</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Schedule New Trip</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Driver</Label>
                <Select value={tripForm.driverId} onValueChange={v => setTripForm({ ...tripForm, driverId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>{drivers.filter((d: any) => d.status === 'active').map((d: any) => <SelectItem key={d.id} value={d.id}>{d.user?.name} ({d.driverCode})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={tripForm.date} onChange={e => setTripForm({ ...tripForm, date: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Start Mileage</Label><Input type="number" value={tripForm.startMileage || ''} onChange={e => setTripForm({ ...tripForm, startMileage: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Fuel Cost (AED)</Label><Input type="number" value={tripForm.fuelCost || ''} onChange={e => setTripForm({ ...tripForm, fuelCost: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2"><Label>Notes</Label><Textarea value={tripForm.notes} onChange={e => setTripForm({ ...tripForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTripOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => createTripMut.mutate(tripForm)} disabled={!tripForm.driverId || !tripForm.date}>Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={`grid w-full ${currentRole === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} max-w-md`}>
          <TabsTrigger value="today">Today&apos;s Board</TabsTrigger>
          {currentRole === 'admin' && <TabsTrigger value="drivers">Drivers ({drivers.length})</TabsTrigger>}
          <TabsTrigger value="trips">Trips ({trips.length})</TabsTrigger>
        </TabsList>

        {/* TODAY'S ASSIGNMENTS - KANBAN BOARD */}
        <TabsContent value="today" className="mt-4">
          {currentRole === 'driver' && <Card className="border-0 shadow-sm mb-4"><CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-violet-600" />Upcoming Pickups / Drop-offs</CardTitle></CardHeader><CardContent className="space-y-2">{upcomingStops.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming transport stops assigned.</p> : upcomingStops.map((stop: any) => <div key={stop.id} className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><p className="text-sm font-semibold capitalize">{stop.type || 'Stop'}</p><p className="text-xs text-muted-foreground">{stop.address || 'Address not provided'}</p></div><div className="text-right"><p className="text-xs font-medium">{format(parseISO(stop.tripDate), 'dd MMM yyyy')}</p><Badge variant="outline" className="text-[10px] capitalize">{stop.tripStatus.replace('_', ' ')}</Badge></div></div>)}</CardContent></Card>}
          {/* Trip Stats for Today */}
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {[
              { icon: Layers , label: 'Bookings', value: todayBookings.length, gradient: 'from-emerald-400 to-teal-500', sub: format(new Date(), 'dd MMM yyyy') },
              { icon: CalendarCheck, label: 'Scheduled', value: kanbanColumns[0].items.length, gradient: 'from-teal-400 to-cyan-500', sub: 'Pending & confirmed' },
              { icon: Navigation, label: 'In Progress', value: kanbanColumns[2].items.length, gradient: 'from-orange-400 to-amber-500', sub: 'Currently active' },
              { icon: CheckCircle2, label: 'Completed', value: kanbanColumns[3].items.length, gradient: 'from-emerald-500 to-green-500', sub: 'Finished today' },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
                <Card className="border-0 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold mt-1">{card.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white shrink-0`}>
                        <card.icon className="h-5 w-5 transition-transform hover:scale-110" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Trip Stats */}
          {tripStats.total > 0 && (
            <motion.div {...fadeUp} className="mb-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Trips Today</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="text-xs">{tripStats.total} Total</Badge>
                    <Badge variant="outline" className="text-xs border-teal-300 text-teal-700">{tripStats.planned} Planned</Badge>
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">{tripStats.inProgress} Active</Badge>
                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">{tripStats.completed} Done</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Kanban Board */}
          {bookingsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full mt-3" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {kanbanColumns.map((col, colIdx) => {
                const ColIcon = col.icon
                return (
                  <motion.div
                    key={col.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: colIdx * 0.15 }}
                  >
                    <Card className="border-0 shadow-sm h-full">
                      <CardHeader className="px-4 py-3 pb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md ${col.bgColor} flex items-center justify-center`}>
                            <ColIcon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <CardTitle className="text-sm font-semibold">{col.title}</CardTitle>
                          <Badge variant="secondary" className="ml-auto text-xs">{col.items.length}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        <AnimatePresence mode="popLayout">
                          {col.items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                              <p className="text-sm">No bookings</p>
                            </div>
                          ) : col.items.map((b: any) => (
                            <motion.div
                              key={b.id}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.25 }}
                              className="relative bg-muted/40 hover:bg-muted/70 rounded-lg p-3 pl-4 space-y-2 transition-colors "
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-lg" />
                              <div className="flex items-start justify-between">
                                <span className="font-mono text-xs font-semibold">{b.bookingNo}</span>
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">AED {b.netAmount.toLocaleString()}</span>
                              </div>
                              <p className="font-medium text-sm">{b.customer?.user?.name}</p>
                              <p className="text-xs text-muted-foreground">{b.service?.name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.startTime}</span>
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.area || b.city || '-'}</span>
                              </div>
                              {/* Quick action buttons to move status */}
                              <div className="flex gap-1 pt-1">
                                {currentRole === 'driver' && col.id === 'scheduled' && (
                                  <>
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={() => handleKanbanMove(b.id, 'on_the_way')}>
                                      On the Way
                                    </Button>
                                  </>
                                )}
                                {currentRole === 'admin' && col.id === 'in_progress' && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handleKanbanMove(b.id, 'completed')}>
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* DRIVErs TAB */}
        <TabsContent value="drivers" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drvLoading ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6"><Skeleton className="h-28 w-full" /></CardContent></Card>
            ))
            : driverStats.map((d: any, idx: number) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${d.status === 'active' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gray-300'}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {d.user?.name?.charAt(0)}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${d.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">{d.user?.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{d.driverCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${d.status === 'active' || d.status === 'AVAILABLE' ? 'border-emerald-300 text-emerald-700' : 'border-gray-300'} text-xs capitalize`}>
                          {d.status?.toLowerCase()}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                          setDriverForm({ name: d.user?.name || '', phone: d.phone || '', email: d.user?.email || '', licenseNo: d.licenseNo || '', vehicleNo: d.vehicleInfo || '' })
                          setDriverEditId(d.id)
                          setDriverOpen(true)
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Driver</AlertDialogTitle>
                              <AlertDialogDescription>Remove driver {d.user?.name}? This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteDriverMut.mutate(d.id)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Truck className="h-3.5 w-3.5" /><span className="text-xs">{d.vehicleInfo || 'No vehicle info'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /><span className="text-xs">{d.phone || '-'}</span>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center bg-muted/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Truck className="h-3 w-3 text-emerald-500 transition-transform hover:scale-110" />
                          <span className="text-lg font-bold">{d.tripCount}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Total Trips</p>
                      </div>
                      <div className="text-center bg-muted/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Fuel className="h-3 w-3 text-teal-500 transition-transform hover:scale-110" />
                          <span className="text-lg font-bold">{d.totalMileage > 0 ? `${(d.totalMileage / 1000).toFixed(1)}k` : '0'}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Total Mileage</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">License: {d.licenseNo || '-'}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* TRIPS TAB */}
        <TabsContent value="trips" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {[
              { icon: Layers , label: 'All Trips', value: trips.length, gradient: 'from-emerald-400 to-teal-500', sub: 'Total records' },
              { icon: CalendarCheck, label: 'Planned', value: trips.filter((t: any) => t.status === 'planned').length, gradient: 'from-teal-400 to-cyan-500', sub: 'Awaiting start' },
              { icon: Navigation, label: 'In Progress', value: trips.filter((t: any) => t.status === 'in_progress').length, gradient: 'from-orange-400 to-amber-500', sub: 'Currently active' },
              { icon: CheckCircle2, label: 'Completed', value: trips.filter((t: any) => t.status === 'completed').length, gradient: 'from-emerald-500 to-green-500', sub: 'Finished' },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
                <Card className="border-0 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold mt-1">{card.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white shrink-0`}>
                        <card.icon className="h-5 w-5 transition-transform hover:scale-110" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            {tripLoading ? <div className="p-6 space-y-4"><Skeleton className="h-10 w-full" /></div> : (
              <div className="max-h-[440px] overflow-y-auto">
                <Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold"><SortableHeader col={'driverName'}>Driver</SortableHeader></TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">Mileage</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">Fuel Cost</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">Stops</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <AnimatePresence>
                  {sortedTrips.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <span className="text-sm">No trips found</span>
                      </div>
                    </TableCell></TableRow>
                  ) : sortedTrips.map((t: any, idx: number) => (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      className={`border-b border-border/40 ${idx % 2 === 1 ? 'bg-muted/20' : ''} hover:bg-muted/40 transition-colors `}
                    >
                      <TableCell className="text-sm">{format(parseISO(t.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${t.driver?.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <span className="font-medium">{t.driver?.user?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {t.startMileage ? (
                          <span className="font-mono text-xs">
                            {t.startMileage.toLocaleString()}{t.endMileage ? ` → ${t.endMileage.toLocaleString()}` : ''}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {t.fuelCost ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Fuel className="h-3 w-3" />AED {t.fuelCost.toLocaleString()}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{t.stops?.length || 0}</TableCell>
                      <TableCell><Badge className={`${tripStatusColors [t.status] || ''} text-xs`}>{t.status.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {t.status === 'planned' && (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => updateTripMut.mutate({ id: t.id, status: 'in_progress' })}>Start</Button>
                          )}
                          {t.status === 'in_progress' && (
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={() => updateTripMut.mutate({ id: t.id, status: 'completed' })}>Complete</Button>
                          )}
                          {t.status === 'completed' && <span className="text-xs text-muted-foreground">Done</span>}
                          {currentRole === 'admin' && <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Trip</AlertDialogTitle>
                                <AlertDialogDescription>Delete this trip record? This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTripMut.mutate(t.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                  </AnimatePresence>
                </TableBody></Table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


