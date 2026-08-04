'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  User, Mail, Phone, MapPin, Camera, Calendar, Clock, DollarSign, FileText, Plus, Trash2, Edit2, Shield, CheckCircle2, AlertCircle, ChevronRight, Building, Sparkles, Receipt, Download, CreditCard, Lock, Check, Search, Star, Truck, Award, Briefcase, Navigation, BadgeCheck, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, type RoleId } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export interface CustomerAddress {
  id: string
  label: string
  street: string
  building: string
  apt: string
  city: string
  area: string
  isDefault: boolean
}

export function CustomerProfile() {
  const { currentUser, currentRole, setUser } = useAppStore()
  const userRole = (currentUser?.role || currentRole || 'admin') as RoleId

  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('info')
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null)
  const [newAddrOpen, setNewAddrOpen] = useState(false)

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || (userRole === 'admin' ? 'Administrator' : userRole === 'cleaner' ? 'Rashid Khan' : userRole === 'driver' ? 'Tariq Mahmood' : 'Sara Ali'),
    email: currentUser?.email || `${userRole}@khobra.ae`,
    phone: '+971 50 123 4567',
    avatar: '',
    language: 'English',
    emergencyContact: '+971 55 987 6543',
    employeeCode: 'EMP-7842',
    driverCode: 'DRV-9021',
    licenseNo: 'LIC-UAE-89210',
  })

  // Multiple Addresses State for Customer
  const [addresses, setAddresses] = useState<CustomerAddress[]>([
    {
      id: 'addr-1',
      label: 'Home',
      street: 'Marina Promenade, Street 4',
      building: 'Delphine Tower',
      apt: 'Apt 1402',
      city: 'Dubai',
      area: 'Dubai Marina',
      isDefault: true,
    },
    {
      id: 'addr-2',
      label: 'Office',
      street: 'Al Abraj Street',
      building: 'Business Bay Tower 2',
      apt: 'Suite 804',
      city: 'Dubai',
      area: 'Business Bay',
      isDefault: false,
    },
  ])

  // New Address Form
  const [addrForm, setAddrForm] = useState<Partial<CustomerAddress>>({
    label: 'Home',
    street: '',
    building: '',
    apt: '',
    city: 'Dubai',
    area: '',
    isDefault: false,
  })

  // Security Form
  const [secForm, setSecForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Data Queries
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => fetch('/api/khobra-cleaning/bookings').then(r => r.json()),
    enabled: userRole === 'customer',
  })
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/khobra-cleaning/settings').then(r => r.json()),
  })
  const currency = settings?.tenant?.currency || 'AED'

  const downloadInvoice = async () => {
    const invoice = selectedBooking?.invoices?.[0]
    if (!invoice) return
    try {
      const response = await fetch(`/api/khobra-cleaning/invoice-pdf?id=${invoice.id}`)
      if (!response.ok) throw new Error('Invoice PDF could not be generated')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoiceNo || selectedBooking.bookingNo || 'invoice'}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invoice PDF could not be generated')
    }
  }

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => fetch('/api/khobra-cleaning/attendance').then(r => r.json()),
    enabled: userRole === 'cleaner',
  })

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/khobra-cleaning/trips').then(r => r.json()),
    enabled: userRole === 'driver',
  })

  // Picture Upload Handler
  const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setProfileForm(prev => ({ ...prev, avatar: url }))
      toast.success('Profile picture updated!')
    }
  }

  // Profile Update Submission
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentUser) {
      setUser({ ...currentUser, name: profileForm.name, email: profileForm.email })
    }
    toast.success('Profile information updated successfully!')
  }

  // Add Address Handler
  const handleAddAddress = () => {
    if (!addrForm.street || !addrForm.area) {
      toast.error('Please enter street and area')
      return
    }
    const newAddr: CustomerAddress = {
      id: 'addr-' + Date.now(),
      label: addrForm.label || 'Home',
      street: addrForm.street || '',
      building: addrForm.building || '',
      apt: addrForm.apt || '',
      city: addrForm.city || 'Dubai',
      area: addrForm.area || '',
      isDefault: addrForm.isDefault || addresses.length === 0,
    }
    setAddresses(prev => [...prev, newAddr])
    setNewAddrOpen(false)
    setAddrForm({ label: 'Home', street: '', building: '', apt: '', city: 'Dubai', area: '', isDefault: false })
    toast.success('New address added!')
  }

  // Handle Security Update
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (secForm.newPassword !== secForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    try {
      await fetch('/api/khobra-cleaning/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: secForm.currentPassword, newPassword: secForm.newPassword }),
      })
      toast.success('Password changed successfully!')
      setSecForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change password')
    }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-emerald-600 text-white',
    customer: 'bg-cyan-600 text-white',
    cleaner: 'bg-amber-600 text-white',
    driver: 'bg-violet-600 text-white',
  }

  const roleLabels: Record<string, string> = {
    admin: 'System Administrator',
    customer: 'Customer Portal Account',
    cleaner: 'Cleaning Field Specialist',
    driver: 'Transport Fleet Driver',
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg text-2xl font-bold bg-white text-emerald-700">
                {profileForm.avatar ? (
                  <AvatarImage src={profileForm.avatar} alt={profileForm.name} />
                ) : (
                  <AvatarFallback className="bg-white text-emerald-800 font-bold">
                    {profileForm.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white text-emerald-700 shadow-md cursor-pointer hover:bg-emerald-50 transition-colors">
                <Camera className="h-4 w-4" />
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
              </label>
            </div>

            <div className="text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profileForm.name}</h1>
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  {roleLabels[userRole] || 'User Profile'}
                </Badge>
              </div>

              <p className="text-emerald-100 text-sm flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <Mail className="h-3.5 w-3.5" />
                {profileForm.email}
                <span>•</span>
                <Phone className="h-3.5 w-3.5" />
                {profileForm.phone}
              </p>

              {userRole === 'cleaner' && (
                <p className="text-emerald-200 text-xs flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Code: <span className="font-mono font-bold">{profileForm.employeeCode}</span>
                  <span>•</span>
                  Status: Active Cleaner
                </p>
              )}

              {userRole === 'driver' && (
                <p className="text-emerald-200 text-xs flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <Truck className="h-3.5 w-3.5" />
                  Driver ID: <span className="font-mono font-bold">{profileForm.driverCode}</span>
                  <span>•</span>
                  License: {profileForm.licenseNo}
                </p>
              )}

              {userRole === 'customer' && (
                <p className="text-emerald-200 text-xs flex items-center justify-center sm:justify-start gap-1 pt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {addresses.find(a => a.isDefault)?.area || 'Dubai Marina'}, Dubai, UAE
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-Tailored Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            <span>Profile Details</span>
          </TabsTrigger>

          {/* Role-Specific Secondary Tabs */}
          {userRole === 'customer' && (
            <>
              <TabsTrigger value="addresses" className="gap-2">
                <MapPin className="h-4 w-4" />
                <span>Addresses ({addresses.length})</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Receipt className="h-4 w-4" />
                <span>Booking History</span>
              </TabsTrigger>
            </>
          )}

          {userRole === 'cleaner' && (
            <>
              <TabsTrigger value="attendance" className="gap-2">
                <Clock className="h-4 w-4" />
                <span>Attendance History</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Assigned Shifts</span>
              </TabsTrigger>
            </>
          )}

          {userRole === 'driver' && (
            <>
              <TabsTrigger value="trips" className="gap-2">
                <Truck className="h-4 w-4" />
                <span>Dispatch Trips</span>
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="gap-2">
                <Navigation className="h-4 w-4" />
                <span>Vehicle & License</span>
              </TabsTrigger>
            </>
          )}

          {userRole === 'admin' && (
            <TabsTrigger value="system" className="gap-2">
              <Shield className="h-4 w-4" />
              <span>System Permissions</span>
            </TabsTrigger>
          )}

          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Details (All Roles) */}
        <TabsContent value="info" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Personal Profile Settings ({userRole.toUpperCase()})</CardTitle>
              <CardDescription>Manage your contact details, language preferences, and emergency contact.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Full Name *</Label>
                    <Input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Email Address *</Label>
                    <Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Contact Phone Number *</Label>
                    <Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Emergency Contact Phone</Label>
                    <Input value={profileForm.emergencyContact} onChange={e => setProfileForm({ ...profileForm, emergencyContact: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Preferred Language</Label>
                    <Select value={profileForm.language} onValueChange={v => setProfileForm({ ...profileForm, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Arabic">Arabic (العربية)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <Check className="h-4 w-4" />Save Profile Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Only: Saved Addresses */}
        {userRole === 'customer' && (
          <TabsContent value="addresses" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Saved Delivery & Service Addresses</h2>
                <p className="text-xs text-muted-foreground">Configure multiple residential or office addresses for cleaning bookings.</p>
              </div>

              <Dialog open={newAddrOpen} onOpenChange={setNewAddrOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <Plus className="h-4 w-4" />Add New Address
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Address</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-3 text-xs">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Address Label</Label>
                      <Select value={addrForm.label} onValueChange={v => setAddrForm({ ...addrForm, label: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Home">Home</SelectItem>
                          <SelectItem value="Office">Office</SelectItem>
                          <SelectItem value="Villa">Villa</SelectItem>
                          <SelectItem value="Apartment">Apartment</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">City</Label>
                        <Select value={addrForm.city} onValueChange={v => setAddrForm({ ...addrForm, city: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dubai">Dubai</SelectItem>
                            <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                            <SelectItem value="Sharjah">Sharjah</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs">Area / District *</Label>
                        <Input value={addrForm.area} onChange={e => setAddrForm({ ...addrForm, area: e.target.value })} placeholder="e.g. Dubai Marina" className="h-9" required />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Street Name / Number *</Label>
                      <Input value={addrForm.street} onChange={e => setAddrForm({ ...addrForm, street: e.target.value })} placeholder="e.g. Al Wasl Road" className="h-9" required />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Building / Tower Name</Label>
                        <Input value={addrForm.building} onChange={e => setAddrForm({ ...addrForm, building: e.target.value })} placeholder="e.g. Princess Tower" className="h-9" />
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs">Apt / Villa No.</Label>
                        <Input value={addrForm.apt} onChange={e => setAddrForm({ ...addrForm, apt: e.target.value })} placeholder="e.g. Apt 1204" className="h-9" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewAddrOpen(false)}>Cancel</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddAddress}>Save Address</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <Card key={addr.id} className={`border transition-all ${addr.isDefault ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={addr.isDefault ? 'default' : 'outline'} className={addr.isDefault ? 'bg-emerald-600' : ''}>
                        {addr.label}
                      </Badge>
                      {addr.isDefault && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />Default Address
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p className="font-semibold text-foreground text-sm">{addr.building ? `${addr.building}, ` : ''}{addr.apt}</p>
                      <p>{addr.street}</p>
                      <p>{addr.area}, {addr.city}, UAE</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* Customer Only: Booking History & Billing (Master-Detail Structure) */}
        {userRole === 'customer' && (
          <TabsContent value="history" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Booking History ({Array.isArray(bookings) ? bookings.length : 0})</CardTitle>
                  <CardDescription>Select a booking to view complete details & invoice.</CardDescription>
                </CardHeader>
                <CardContent className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                  {Array.isArray(bookings) && bookings.map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedBooking?.id === b.id
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'hover:bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground">#{b.bookingNo || b.id.slice(-6)}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {b.status || 'Scheduled'}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">{b.service?.name || 'Home Cleaning'}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                        <span>{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : 'Today'}</span>
                        <span className="font-bold text-emerald-700">{currency} {Number(b.invoices?.[0]?.totalAmount ?? b.netAmount ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-0 shadow-sm">
                {selectedBooking ? (
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h2 className="text-xl font-bold">Booking #{selectedBooking.bookingNo || selectedBooking.id.slice(-6)}</h2>
                        <p className="text-xs text-muted-foreground">Scheduled for {selectedBooking.scheduledDate ? new Date(selectedBooking.scheduledDate).toLocaleDateString() : 'Today'}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2 text-xs border-emerald-300 text-emerald-700" onClick={downloadInvoice} disabled={!selectedBooking.invoices?.[0]}>
                        <Download className="h-3.5 w-3.5" />Download Invoice PDF
                      </Button>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2 text-xs">
                      <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
                        <Receipt className="h-4 w-4 text-emerald-600" />
                        Complete Billing Breakdown
                      </h3>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Service Subtotal:</span>
                        <span>{currency} {Number(selectedBooking.invoices?.[0]?.subtotal ?? selectedBooking.totalAmount ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax:</span>
                        <span>{currency} {Number(selectedBooking.invoices?.[0]?.taxAmount ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between font-bold text-sm text-foreground">
                        <span>Total Net Billing Amount:</span>
                        <span className="text-emerald-700">{currency} {Number(selectedBooking.invoices?.[0]?.totalAmount ?? selectedBooking.netAmount ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-2 min-h-[350px]">
                    <Receipt className="h-10 w-10 text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-sm">Select a booking to view billing details</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Employee Only: Attendance & Shifts */}
        {userRole === 'cleaner' && (
          <TabsContent value="attendance" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Shift Attendance & Time Log</CardTitle>
                <CardDescription>Track daily clock-in/out logs and shift duration</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(attendanceRecords) && attendanceRecords.map((att: any) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-semibold text-xs">{new Date(att.date || Date.now()).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{att.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00 AM'}</TableCell>
                        <TableCell className="text-xs">{att.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '05:00 PM'}</TableCell>
                        <TableCell><Badge className="bg-emerald-600">Present</Badge></TableCell>
                      </TableRow>
                    ))}
                    {(!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">Shift attendance records updated daily by Supervisor.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Driver Only: Trips & Dispatch */}
        {userRole === 'driver' && (
          <TabsContent value="trips" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Assigned Dispatch Trips History</CardTitle>
                <CardDescription>View assigned transport routes and field cleaner drop-offs</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Trip Code</TableHead>
                      <TableHead>Route / Area</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(trips) && trips.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-semibold text-xs">#{t.tripNo || t.id.slice(-6)}</TableCell>
                        <TableCell className="text-xs">{t.route || 'Dubai Marina -> Business Bay'}</TableCell>
                        <TableCell><Badge className="bg-cyan-600">Completed</Badge></TableCell>
                      </TableRow>
                    ))}
                    {(!Array.isArray(trips) || trips.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">Dispatch trip schedule updated daily by Fleet Manager.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Admin Only: System Permissions Overview */}
        {userRole === 'admin' && (
          <TabsContent value="system" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Administrator Access Control Level</CardTitle>
                <CardDescription>Full platform control across all system modules and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold text-sm text-foreground">Super Administrator Privileges Granted</span>
                  </div>
                  <p className="text-muted-foreground">You have unrestricted CRUD access across all 15 system modules including Access Control (RBAC), Financial Invoicing, Cleaner Payroll, Customer CRM, and Operations Dispatch.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 4: Security (All Roles) */}
        <TabsContent value="security" className="mt-4">
          <Card className="border-0 shadow-sm max-w-xl">
            <CardHeader>
              <CardTitle className="text-base">Account Security & Password</CardTitle>
              <CardDescription>Update your password and manage account security settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSecurity} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Current Password</Label>
                  <Input type="password" value={secForm.currentPassword} onChange={e => setSecForm({ ...secForm, currentPassword: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">New Password</Label>
                  <Input type="password" value={secForm.newPassword} onChange={e => setSecForm({ ...secForm, newPassword: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Confirm New Password</Label>
                  <Input type="password" value={secForm.confirmPassword} onChange={e => setSecForm({ ...secForm, confirmPassword: e.target.value })} required />
                </div>

                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2 text-xs">
                  <Lock className="h-3.5 w-3.5" />Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
