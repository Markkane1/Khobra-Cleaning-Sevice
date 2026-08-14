'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, Search, Eye, Calendar, Clock, MapPin, Navigation, Users, FileText, CheckCircle2, XCircle, ChevronLeft, ChevronRight, LayoutList, Download, Trash2, UserCheck, Star, ChevronsUpDown, Truck, Banknote, Building2, CreditCard, RotateCcw, Upload, ShieldCheck, Copy, MessageSquareWarning, Phone, TriangleAlert, Edit2 } from 'lucide-react'
import { calculateBookingFinancials, canCustomerEditBooking, CreateBookingSchema, getDirectionsUrl, isTerminalBookingStatus, zonedDateTimeToUtc, MIN_BOOKING_DURATION_HOURS } from '@repo/core'
import { Capacitor } from '@capacitor/core'
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { exportToCSV } from '@/lib/csv-export'
import { useSortable } from '@/hooks/use-sort'
import { useRealtime } from '@/hooks/use-realtime'
import { useAppStore } from '@/store/app-store'
import { apiRequest } from '@/lib/api-client'
import { calculateDurationHours, calculateEndTimeFromDuration, calculateMultiServicePricing } from '@repo/core'

const statusColors: Record<string, string> = {
  pending_assignment: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  scheduled: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  confirmed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  on_the_way: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  no_show: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const statusBorderColors: Record<string, string> = {
  pending_assignment: 'border-l-amber-400',
  pending: 'border-l-amber-400',
  assigned: 'border-l-blue-400',
  scheduled: 'border-l-teal-400',
  confirmed: 'border-l-teal-400',
  on_the_way: 'border-l-cyan-400',
  in_progress: 'border-l-orange-400',
  completed: 'border-l-emerald-400',
  cancelled: 'border-l-red-400',
  no_show: 'border-l-purple-400',
}

const statusDotColors: Record<string, string> = {
  pending_assignment: 'bg-amber-400',
  pending: 'bg-amber-400',
  assigned: 'bg-blue-400',
  scheduled: 'bg-teal-400',
  confirmed: 'bg-teal-400',
  on_the_way: 'bg-cyan-400',
  in_progress: 'bg-orange-400',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  no_show: 'bg-purple-400',
}

const statusDisplayLabels: Record<string, string> = {
  pending_assignment: 'Pending Assignment',
  pending: 'Pending Assignment',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  confirmed: 'Scheduled',
  on_the_way: 'On the Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const paymentStatusColors: Record<string, string> = {
  payment_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300',
  cash_selected: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-300',
  bank_transfer_submitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300',
  under_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300',
}

const paymentStatusLabels: Record<string, string> = {
  payment_pending: 'Payment Pending',
  cash_selected: 'Cash Selected',
  bank_transfer_submitted: 'Bank Transfer Submitted',
  under_verification: 'Under Verification',
  paid: 'Paid',
  rejected: 'Payment Rejected',
}

const pipelineSteps = [
  { key: 'pending_assignment', label: 'Pending Assignment', icon: Calendar },
  { key: 'assigned', label: 'Assigned', icon: UserCheck },
  { key: 'scheduled', label: 'Scheduled', icon: CheckCircle2 },
  { key: 'on_the_way', label: 'On the Way', icon: Truck },
  { key: 'in_progress', label: 'In Progress', icon: Clock },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
]

const emptyForm = { customerId: '', serviceIds: [] as string[], serviceOptions: {} as Record<string, boolean>, preferredEmployeeId: '', preferredEmployeeIds: [] as string[], hasPreferredEmployee: false, scheduledDate: '', selectedDates: [] as string[], bookingType: 'one_time', startDate: '', endDate: '', selectedWeekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '11:00', employeeCount: 1, preferredPaymentMethod: 'cash', address: '', city: '', area: '', notes: '' }

const customerAddresses = (customer: any) => {
  const saved = Array.isArray(customer?.addresses) ? customer.addresses.filter((address: any) => address?.address) : []
  return saved.length ? saved : customer?.address ? [{ label: 'Primary', address: customer.address, city: customer.city || '', area: customer.area || '' }] : []
}

const bookingAddressOptions = (savedAddresses: any[], booking: any) => {
  if (!booking?.address || savedAddresses.some(address => address.address === booking.address && (address.area || '') === (booking.area || ''))) return savedAddresses
  return [{ label: 'Current booking address', address: booking.address, city: booking.city || '', area: booking.area || '', latitude: booking.latitude, longitude: booking.longitude }, ...savedAddresses]
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const canonicalStatus = (status: string) => status === 'pending' ? 'pending_assignment' : status === 'confirmed' ? 'scheduled' : status
const isEndedStatus = (status: string) => ['cancelled', 'no_show'].includes(canonicalStatus(status))
const overdueRecommendation = (status: string) => {
  switch (canonicalStatus(status)) {
    case 'in_progress': return 'Confirm completion or report an issue.'
    case 'on_the_way': return 'Contact the driver and update the arrival status.'
    case 'scheduled': return 'Contact the customer and team, then reschedule or mark no-show.'
    default: return 'Assign or reschedule the team; cancel if service will not proceed.'
  }
}

const openDirections = (booking: { bookingNo: string; latitude?: number | null; longitude?: number | null }) => {
  if (booking.latitude == null || booking.longitude == null) return
  const nativePlatform = Capacitor.getPlatform()
  const platform = nativePlatform === 'ios' || nativePlatform === 'android' ? nativePlatform : 'web'
  const url = getDirectionsUrl(platform, booking.latitude, booking.longitude, booking.bookingNo)
  if (Capacitor.isNativePlatform()) window.location.assign(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

const calendarStatusDotColors : Record<string, string> = {
  completed: 'bg-emerald-500',
  in_progress: 'bg-orange-500',
  on_the_way: 'bg-cyan-500',
  scheduled: 'bg-teal-400',
  assigned: 'bg-blue-400',
  pending_assignment: 'bg-yellow-400',
  cancelled: 'bg-red-400',
}

const legendItems = [
  { status: 'completed', label: 'Completed', color: 'bg-emerald-500' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-orange-500' },
  { status: 'on_the_way', label: 'On the Way', color: 'bg-cyan-500' },
  { status: 'scheduled', label: 'Scheduled', color: 'bg-teal-400' },
  { status: 'pending_assignment', label: 'Pending Assignment', color: 'bg-yellow-400' },
  { status: 'cancelled', label: 'Cancelled', color: 'bg-red-400' },
]

export function Bookings() {
  const currentRole = useAppStore(s => s.currentRole)
  const currentUser = useAppStore(s => s.currentUser)
  const setView = useAppStore(s => s.setView)
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [editingCustomerBooking, setEditingCustomerBooking] = useState<any | null>(null)
  const [customerEditForm, setCustomerEditForm] = useState({ scheduledDate: '', startTime: '', endTime: '', employeeCount: 1, serviceIds: [] as string[], serviceOptions: {} as Record<string, boolean>, addressIndex: '0', notes: '' })
  const [form, setForm] = useState(emptyForm)
  const [bookingStep, setBookingStep] = useState(0)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedCustomerAddressIndex, setSelectedCustomerAddressIndex] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cleanerDateScope, setCleanerDateScope] = useState<'today' | 'all'>('today')
  const [driverScope, setDriverScope] = useState<'today' | 'completed' | 'pending' | 'upcoming'>('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('table')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [popoverDay, setPopoverDay] = useState<Date | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLButtonElement | null>(null)
  const [now, setNow] = useState<number | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Real-time updates
  const { subscribe, onEvent } = useRealtime()
  useEffect(() => { subscribe("booking:updated") }, [subscribe])
  useEffect(() => {
    onEvent("booking:updated", (event) => {
      qc.invalidateQueries({ queryKey: ["bookings"] })
      const msg = (event.payload.message as string) || "Booking status changed"
      toast.info(msg, { duration: 3000 })
    })
  }, [onEvent, qc])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/bookings'),
  })

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/customers'),
    enabled: currentRole === 'admin' || currentRole === 'customer',
  })

  const { data: services = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/services'),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/employees'),
    enabled: currentRole === 'admin',
  })

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiRequest<any[]>('/api/khobra-cleaning/drivers'),
    enabled: currentRole === 'admin',
  })

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()
    return term ? customers.filter((customer: any) => `${customer.user?.name || ''} ${customer.user?.email || ''} ${customer.city || ''} ${customer.area || ''}`.toLowerCase().includes(term)) : customers
  }, [customers, customerSearch])
  const selectedCustomer = customers.find((customer: any) => customer.id === form.customerId)
  const selectedCustomerAddresses = customerAddresses(selectedCustomer)
  const requiresAddressSelection = selectedCustomerAddresses.length > 1
  const customerRecord = customers.find((customer: any) => customer.userId === currentUser?.userId)
  const customerEditAddresses = customerAddresses(customerRecord)
  const customerEditAddressOptions = bookingAddressOptions(customerEditAddresses, editingCustomerBooking)

  const handleBookingOpenChange = (nextOpen: boolean) => {
    if (nextOpen && currentRole === 'customer') {
      const customer = customers.find((item: any) => item.userId === currentUser?.userId)
      const primary = customerAddresses(customer)[0]
      if (!customer || !primary) {
        toast.error('Add a primary address in Profile before booking', { action: { label: 'Go to Profile', onClick: () => setView('profile') } })
        return
      }
      setForm({ ...emptyForm, customerId: customer.id, address: primary.address, city: primary.city || '', area: primary.area || '' })
      setSelectedCustomerAddressIndex('0')
      setCustomerPickerOpen(false)
    } else {
      setCustomerPickerOpen(false)
    }
    setOpen(nextOpen)
    if (!nextOpen) { setForm(emptyForm); setBookingStep(0); setBookingError(null); setCustomerSearch(''); setSelectedCustomerAddressIndex('') }
  }

  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiRequest<any>('/api/khobra-cleaning/settings'),
  })
  const firstBookingTime = tenantSettings?.tenant?.firstBookingTime || '08:00'
  const lastWorkingTime = tenantSettings?.tenant?.lastWorkingTime || '20:00'
  const currency = tenantSettings?.tenant?.currency || 'AED'
  const isBookingOverdue = useCallback((booking: any) => {
    if (now === null || isTerminalBookingStatus(booking.status) || !booking.scheduledDate || !booking.startTime) return false
    const endTime = booking.endTime || calculateEndTimeFromDuration(booking.startTime, booking.duration)
    try {
      return zonedDateTimeToUtc(booking.scheduledDate.slice(0, 10), endTime, tenantSettings?.tenant?.timezone || 'UTC').getTime() < now
    } catch {
      return false
    }
  }, [now, tenantSettings?.tenant?.timezone])
  const customerCanEditBooking = useCallback((booking: any) => {
    if (now === null || !['pending_assignment', 'pending', 'assigned', 'scheduled', 'confirmed'].includes(booking.status)) return false
    try {
      return canCustomerEditBooking(booking.scheduledDate, booking.startTime, tenantSettings?.tenant?.timezone || 'UTC', new Date(now))
    } catch {
      return false
    }
  }, [now, tenantSettings?.tenant?.timezone])

  const createMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/bookings', { method: 'POST', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async r => {
      const res = await r.json()
      if (!r.ok) throw new Error(Array.isArray(res.issues) ? res.issues.map((issue: { message: string }) => issue.message).join(' ') : res.error || 'Failed to create booking')
      return res
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Booking created successfully'); setBookingError(null); setOpen(false); setForm(emptyForm); setBookingStep(0); setSelectedCustomerAddressIndex('') },
    onError: (err: any) => { const message = err.message || 'Failed to create booking'; setBookingError(message); toast.error(message) },
  })

  const updateMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/bookings', { method: 'PUT', headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async r => {
      const res = await r.json()
      if (!r.ok) throw new Error(res.error || 'Failed to update booking')
      return res
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); toast.success('Booking status updated') },
    onError: (err: any) => toast.error(err.message || 'Failed to update booking'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/khobra-cleaning/bookings?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking deleted successfully')
    },
    onError: () => toast.error('Failed to delete booking'),
  })

  const [assigningBooking, setAssigningBooking] = useState<any | null>(null)
  const [selectedAssignEmpIds, setSelectedAssignEmpIds] = useState<string[]>([])
  const [selectedAssignDriverId, setSelectedAssignDriverId] = useState('')

  const assignMut = useMutation({
    mutationFn: (d: { bookingId: string; driverId: string; employeeIds?: string[]; autoAssign?: boolean }) =>
      fetch('/api/khobra-cleaning/bookings/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Assignment failed')
        return res
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['trips'] })
      toast.success(`Booking ${data.bookingNo} assigned! Total recalculated: ${currency} ${data.netAmount}`)
      setAssigningBooking(null)
      setSelectedAssignEmpIds([])
      setSelectedAssignDriverId('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Assignment failed')
    },
  })

  const [ratingBooking, setRatingBooking] = useState<any | null>(null)
  const [empRatings, setEmpRatings] = useState<Record<string, number>>({})
  const [overallRating, setOverallRating] = useState<number>(5.0)
  const [overallComment, setOverallComment] = useState<string>('')

  const rateMut = useMutation({
    mutationFn: (d: { bookingId: string; overallRating?: number; overallComment?: string; ratings: Array<{ assignmentId?: string; employeeId: string; rating: number; notes?: string }> }) =>
      fetch('/api/khobra-cleaning/bookings/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Rating failed')
        return res
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Thank you! Your ratings and feedback have been submitted.')
      setRatingBooking(null)
      setEmpRatings({})
      setOverallRating(5.0)
      setOverallComment('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit ratings')
    },
  })

  const [paymentBooking, setPaymentBooking] = useState<any | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [paymentFields, setPaymentFields] = useState({ referenceNo: '', customerBankName: '', accountHolderName: '', transferDate: format(new Date(), 'yyyy-MM-dd'), transferAmount: '', proofUrl: '', remarks: '' })
  const [isUploadingProof, setIsUploadingProof] = useState(false)

  useEffect(() => {
    if (!paymentBooking) return
    const refreshedBooking = items.find((booking: any) => booking.id === paymentBooking.id)
    if (refreshedBooking && !calculateBookingFinancials(refreshedBooking).canSelectPaymentMethod) setPaymentBooking(null)
  }, [items, paymentBooking])

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')
  const [cleanerCompleteBookingConfirm, setCleanerCompleteBookingConfirm] = useState<any | null>(null)
  const [issueBooking, setIssueBooking] = useState<any | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [issuePriority, setIssuePriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')

  const reportCustomerIssueMut = useMutation({
    mutationFn: (d: { bookingId: string; description: string; priority: string }) => fetch('/api/khobra-cleaning/complaints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, category: 'Customer Issue' }),
    }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to report customer issue')
      return body
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Customer issue reported')
      setIssueBooking(null)
      setIssueDescription('')
      setIssuePriority('medium')
    },
    onError: (error: any) => toast.error(error.message || 'Failed to report customer issue'),
  })

  const cleanerCompleteMut = useMutation({
    mutationFn: (d: { bookingId: string; notes?: string }) =>
      fetch('/api/khobra-cleaning/bookings/cleaner-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Failed to complete booking')
        return res
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`Booking ${data.booking?.bookingNo || ''} marked as Completed!`)
      setCleanerCompleteBookingConfirm(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error marking booking as completed')
    },
  })

  const { data: companyAccountsData } = useQuery({
    queryKey: ['companyBankAccountsCustomer'],
    queryFn: () => apiRequest<any>('/api/khobra-cleaning/company-bank-accounts'),
    enabled: Boolean(paymentBooking && paymentMethod === 'bank_transfer'),
  })

  const selectPaymentMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/bookings/payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Payment selection failed')
        return res
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment method selected successfully!')
      setPaymentBooking(null)
      setPaymentFields({ referenceNo: '', customerBankName: '', accountHolderName: '', transferDate: format(new Date(), 'yyyy-MM-dd'), transferAmount: '', proofUrl: '', remarks: '' })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Payment selection failed')
    },
  })

  const submitBankTransferMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/bookings/bank-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async r => {
      const res = await r.json()
      if (!r.ok) throw new Error(res.error || 'Bank transfer submission failed')
      return res
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Bank transfer submitted for Admin verification')
      setPaymentBooking(null)
      setPaymentFields({ referenceNo: '', customerBankName: '', accountHolderName: '', transferDate: format(new Date(), 'yyyy-MM-dd'), transferAmount: '', proofUrl: '', remarks: '' })
    },
    onError: (err: any) => toast.error(err.message || 'Bank transfer submission failed'),
  })

  const reopenPaymentMut = useMutation({
    mutationFn: (d: { bookingId: string; reason?: string }) =>
      fetch('/api/khobra-cleaning/bookings/reopen-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Reopen payment failed')
        return res
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment reopened! Customer can now re-select payment method.')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Reopen payment failed')
    },
  })

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Payment proof must be a JPG, PNG, WEBP, or PDF up to 5 MB')
      e.target.value = ''
      return
    }
    setIsUploadingProof(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'payment-proofs')
      const res = await fetch('/api/khobra-cleaning/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setPaymentFields(prev => ({ ...prev, proofUrl: data.url }))
      toast.success('Payment proof uploaded successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Payment proof upload failed')
    } finally {
      setIsUploadingProof(false)
    }
  }

  const [cleanerCashBooking, setCleanerCashBooking] = useState<any | null>(null)

  const cleanerReceiveCashMut = useMutation({
    mutationFn: (d: { bookingId: string; remarks?: string }) =>
      fetch('/api/khobra-cleaning/bookings/cleaner-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Cash collection failed')
        return res
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(`Cash payment of ${data.currency || currency} ${data.amountReceived} recorded successfully!`)
      setCleanerCashBooking(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Cash collection failed')
    },
  })

  const [reviewingBankTransferBooking, setReviewingBankTransferBooking] = useState<any | null>(null)
  const [decisionRemarks, setDecisionRemarks] = useState('')

  const decideBankTransferMut = useMutation({
    mutationFn: (d: { paymentId: string; decision: 'approve' | 'reject'; remarks?: string }) =>
      fetch('/api/khobra-cleaning/bookings/bank-transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async r => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Decision failed')
        return res
      }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(variables.decision === 'approve' ? 'Bank transfer approved successfully!' : 'Bank transfer rejected!')
      setReviewingBankTransferBooking(null)
      setDecisionRemarks('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Decision failed')
    },
  })

  const { data: assignAvailability, error: assignAvailabilityError } = useQuery<any>({
    queryKey: ['availability', assigningBooking?.scheduledDate, assigningBooking?.startTime, assigningBooking?.endTime],
    queryFn: () => apiRequest(`/api/khobra-cleaning/employees/availability?date=${assigningBooking?.scheduledDate?.split('T')[0]}&startTime=${assigningBooking?.startTime}&endTime=${assigningBooking?.endTime}&serviceIds=${(assigningBooking?.items?.map((item: any) => item.serviceId) || [assigningBooking?.serviceId]).filter(Boolean).join(',')}`),
    enabled: Boolean(assigningBooking),
  })

  const duration = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0
    return calculateDurationHours(form.startTime, form.endTime)
  }, [form.startTime, form.endTime])

  const isTimeInvalid = Boolean(form.startTime && form.endTime && duration < MIN_BOOKING_DURATION_HOURS)
  const minimumBookingAt = currentRole === 'customer' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : new Date()
  const minimumBookingDate = format(minimumBookingAt, 'yyyy-MM-dd')
  const minimumBookingTime = format(minimumBookingAt, 'HH:mm')
  const scheduleIncludesToday = form.bookingType === 'one_time'
    ? form.scheduledDate === minimumBookingDate
    : form.bookingType === 'multiple_dates'
      ? form.selectedDates.includes(minimumBookingDate)
      : Boolean(form.startDate && form.endDate && form.startDate <= minimumBookingDate && form.endDate >= minimumBookingDate && (form.bookingType === 'daily_recurring' || form.selectedWeekdays.includes(minimumBookingAt.getDay())))
  const earliestStartTime = scheduleIncludesToday && minimumBookingTime > firstBookingTime ? minimumBookingTime : firstBookingTime
  const isPastStartTime = scheduleIncludesToday && form.startTime < earliestStartTime
  const hasScheduleDates = form.bookingType === 'one_time'
    ? Boolean(form.scheduledDate)
    : form.bookingType === 'multiple_dates'
      ? form.selectedDates.length > 0 || Boolean(form.scheduledDate)
      : Boolean(form.startDate && form.endDate)
  const selectedBookingDates = form.bookingType === 'multiple_dates' && form.selectedDates.length === 0 && form.scheduledDate
    ? [form.scheduledDate]
    : form.selectedDates
  const bookingPayload = {
    ...form,
    scheduledDate: form.scheduledDate || undefined,
    selectedDates: form.bookingType === 'multiple_dates' ? selectedBookingDates : undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    preferredEmployeeIds: form.hasPreferredEmployee ? form.preferredEmployeeIds : undefined,
    preferredEmployeeId: undefined,
    serviceIds: form.serviceIds,
    serviceId: form.serviceIds[0],
    serviceOptions: form.serviceIds.map(serviceId => ({ serviceId, withMaterials: form.serviceOptions[serviceId] || false })),
    duration,
  }
  const bookingValidation = CreateBookingSchema.safeParse(bookingPayload)
  const bookingValidationError = !bookingValidation.success ? bookingValidation.error.issues[0]?.message : null
  const canContinueBooking = bookingStep === 0
    ? Boolean(form.customerId && form.serviceIds.length && (!requiresAddressSelection || selectedCustomerAddressIndex))
    : bookingStep === 1
      ? Boolean(hasScheduleDates && form.startTime && form.endTime && duration >= MIN_BOOKING_DURATION_HOURS && !isPastStartTime)
      : true
  const { data: availability, isLoading: isAvailLoading, error: availabilityError } = useQuery<any>({
    queryKey: ['employee-availability', form.bookingType === 'multiple_dates' ? form.selectedDates[0] || form.scheduledDate : form.scheduledDate, form.startTime, form.endTime, form.serviceIds.join(',')],
    queryFn: async () => {
      const date = form.bookingType === 'multiple_dates' ? form.selectedDates[0] || form.scheduledDate : form.scheduledDate
      if (!date || !form.startTime || !form.endTime || duration < MIN_BOOKING_DURATION_HOURS) return null
      return apiRequest(`/api/khobra-cleaning/employees/availability?date=${date}&startTime=${form.startTime}&endTime=${form.endTime}&serviceIds=${form.serviceIds.join(',')}`)
    },
    enabled: Boolean((form.bookingType === 'multiple_dates' ? form.selectedDates[0] || form.scheduledDate : form.scheduledDate) && form.startTime && form.endTime && duration >= MIN_BOOKING_DURATION_HOURS),
  })

  const canCreateBooking = Boolean(
    form.customerId && form.serviceIds.length && (!requiresAddressSelection || selectedCustomerAddressIndex) && hasScheduleDates && form.startTime && form.endTime && duration >= MIN_BOOKING_DURATION_HOURS && !isPastStartTime && availability?.availableCount >= form.employeeCount &&
    (!form.hasPreferredEmployee || (form.preferredEmployeeIds.length <= form.employeeCount && form.preferredEmployeeIds.every(id => availability?.allEmployeesStatus?.find((employee: any) => employee.id === id)?.isAvailable))) &&
    bookingValidation.success
  )

  const selectedServices = useMemo(() => {
    return services.filter((s: any) => form.serviceIds.includes(s.id)).map((service: any) => ({ ...service, includesMaterials: form.serviceOptions[service.id] || false, baseRate: form.serviceOptions[service.id] ? service.withMaterialsRate : service.baseRate }))
  }, [services, form.serviceIds, form.serviceOptions])

  const multiPricing = useMemo(() => {
    return calculateMultiServicePricing(
      selectedServices,
      form.employeeCount,
      duration,
      [],
      0,
      tenantSettings?.tenant?.taxRate || 0
    )
  }, [selectedServices, form.employeeCount, duration, tenantSettings?.tenant?.taxRate])

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { total: 0, pending_assignment: 0, assigned: 0, scheduled: 0, on_the_way: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 }
    items.forEach((b: any) => {
      counts.total++
      const status = canonicalStatus(b.status)
      if (counts[status] !== undefined) counts[status]++
    })
    return counts
  }, [items])

  const filtered = useMemo(() => items.filter((b: any) => {
    const bookingDate = format(parseISO(b.scheduledDate), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    if (currentRole === 'cleaner' && cleanerDateScope === 'today' && bookingDate !== today) return false
    if (currentRole === 'driver') {
      if (driverScope === 'today' && bookingDate !== today) return false
      if (driverScope === 'completed' && (bookingDate !== today || canonicalStatus(b.status) !== 'completed')) return false
      if (driverScope === 'pending' && (bookingDate !== today || !['pending_assignment', 'assigned', 'scheduled'].includes(canonicalStatus(b.status)))) return false
      if (driverScope === 'upcoming' && (bookingDate < today || ['completed', 'cancelled', 'no_show'].includes(canonicalStatus(b.status)))) return false
    }
    if (currentRole === 'admin' && activeTab === 'table' && dateFrom && bookingDate < dateFrom) return false
    if (currentRole === 'admin' && activeTab === 'table' && dateTo && bookingDate > dateTo) return false
    if (statusFilter !== 'all' && canonicalStatus(b.status) !== statusFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return b.bookingNo?.toLowerCase().includes(s) || b.customer?.user?.name?.toLowerCase().includes(s) || b.service?.name?.toLowerCase().includes(s)
  }), [items, currentRole, cleanerDateScope, driverScope, activeTab, dateFrom, dateTo, statusFilter, search])

  const { sorted: sortedBookings, SortableHeader } = useSortable<any>(filtered, 'bookingNo')

  const handleExport = () => {
    const exportData = filtered.map((b: any) => ({
      'Booking No': b.bookingNo || '',
      'Customer': b.customer?.user?.name || '',
      'Service': b.service?.name || '',
      'Scheduled Date': b.scheduledDate || '',
      'Start Time': b.startTime || '',
      'Duration': b.duration || '',
      'Status': b.status || '',
      'Net Amount': b.netAmount || 0,
      'City': b.city || '',
      'Area': b.area || '',
    }))
    exportToCSV(exportData, 'bookings')
    toast.success('Exported')
  }

  // Calendar: build the grid of day cells for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // Sunday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const days: Date[] = []
    let day = calStart
    while (day <= calEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Map bookings to their date keys for quick lookup
  const bookingsByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    items.forEach((b: any) => {
      if (!b.scheduledDate) return
      try {
        const dateKey = format(parseISO(b.scheduledDate), 'yyyy-MM-dd')
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(b)
      } catch {
        // skip malformed dates
      }
    })
    return map
  }, [items])

  const handleStatusChange = (id: string, newStatus: string) => {
    updateMut.mutate({ id, status: newStatus })
  }

  const openCustomerBookingEditor = (booking: any) => {
    const serviceIds = booking.items?.length ? booking.items.map((item: any) => item.serviceId) : booking.serviceId ? [booking.serviceId] : []
    const serviceOptions = Object.fromEntries((booking.items || []).map((item: any) => [item.serviceId, Boolean(item.includesMaterials)]))
    const addresses = bookingAddressOptions(customerEditAddresses, booking)
    const addressIndex = Math.max(0, addresses.findIndex((address: any) => address.address === booking.address && (address.area || '') === (booking.area || '')))
    setCustomerEditForm({
      scheduledDate: String(booking.scheduledDate).slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime || calculateEndTimeFromDuration(booking.startTime, booking.duration),
      employeeCount: booking.employeeCount || 1,
      serviceIds,
      serviceOptions,
      addressIndex: String(addressIndex),
      notes: booking.notes || '',
    })
    setEditingCustomerBooking(booking)
    setDetailOpen(false)
  }

  const customerEditDuration = calculateDurationHours(customerEditForm.startTime, customerEditForm.endTime)
  const customerEditTimeAllowed = Boolean(customerEditForm.scheduledDate && customerEditForm.startTime && now !== null && (() => {
    try {
      return canCustomerEditBooking(customerEditForm.scheduledDate, customerEditForm.startTime, tenantSettings?.tenant?.timezone || 'UTC', new Date(now))
    } catch {
      return false
    }
  })())
  const canSaveCustomerEdit = Boolean(customerEditForm.serviceIds.length && customerEditForm.employeeCount >= 1 && customerEditDuration >= MIN_BOOKING_DURATION_HOURS && customerEditTimeAllowed && customerEditAddressOptions[Number(customerEditForm.addressIndex)])

  const saveCustomerBookingEdit = () => {
    if (!editingCustomerBooking || !canSaveCustomerEdit) return
    const address = customerEditAddressOptions[Number(customerEditForm.addressIndex)]
    updateMut.mutate({
      id: editingCustomerBooking.id,
      scheduledDate: customerEditForm.scheduledDate,
      startTime: customerEditForm.startTime,
      endTime: customerEditForm.endTime,
      employeeCount: customerEditForm.employeeCount,
      serviceIds: customerEditForm.serviceIds,
      serviceId: customerEditForm.serviceIds[0],
      serviceOptions: customerEditForm.serviceIds.map(serviceId => ({ serviceId, withMaterials: Boolean(customerEditForm.serviceOptions[serviceId]) })),
      address: address.address,
      city: address.city || '',
      area: address.area || '',
      latitude: address.latitude,
      longitude: address.longitude,
      notes: customerEditForm.notes,
    }, { onSuccess: () => setEditingCustomerBooking(null) })
  }

  const handleRowClick = (b: any) => {
    setSelectedBooking(b)
    setDetailOpen(true)
  }

  const getPipelineIndex = (status: string) => {
    return pipelineSteps.findIndex(s => s.key === canonicalStatus(status))
  }

  const goToToday = useCallback(() => {
    setCurrentMonth(new Date())
    setPopoverDay(null)
  }, [])

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1))
    setPopoverDay(null)
  }, [])

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1))
    setPopoverDay(null)
  }, [])

  const handleDayClick = useCallback((day: Date, el?: HTMLButtonElement) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayBookings = bookingsByDate[dateKey]
    if (dayBookings && dayBookings.length > 0) {
      setPopoverDay(day)
      setPopoverAnchor(el || null)
    }
  }, [bookingsByDate])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage service bookings and scheduling</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
          <Dialog open={open} onOpenChange={handleBookingOpenChange}>
            <Tooltip>
              <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button disabled={currentRole === 'cleaner' || currentRole === 'driver' || (currentRole === 'customer' && isLoadingCustomers)} className={`bg-emerald-600 hover:bg-emerald-700 ${currentRole === 'cleaner' || currentRole === 'driver' ? 'hidden' : ''}`}><Plus className="h-4 w-4 mr-2" />New Booking</Button>
            </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">N</kbd></TooltipContent>
            </Tooltip>
          <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-0 p-4 text-sm sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:border sm:p-6 [&_[data-slot=label]]:text-sm">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
              <div className="flex gap-1 pt-2" aria-label={`Step ${bookingStep + 1} of 4`}>
                {[0, 1, 2, 3].map(step => <div key={step} className={`h-1 flex-1 rounded ${step <= bookingStep ? 'bg-emerald-600' : 'bg-muted'}`} />)}
              </div>
              <p className="text-xs text-muted-foreground">Step {bookingStep + 1} of 4 — {[(currentRole === 'customer' ? 'Services' : 'Customer & services'), 'Schedule', 'Staff & address', 'Billing details'][bookingStep]}</p>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {bookingStep === 0 && <>
              {currentRole === 'admin' && <div className="grid gap-2"><Label>Customer</Label>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={customerPickerOpen} className="justify-between font-normal">
                      {selectedCustomer ? `${selectedCustomer.user?.name || 'Unnamed customer'}${selectedCustomer.area || selectedCustomer.city ? ` — ${selectedCustomer.area || selectedCustomer.city}` : ''}` : 'Search customer...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                    <Input autoFocus value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Search by name, email, or area..." />
                    <div className="mt-2 max-h-52 overflow-y-auto" role="listbox">
                      {isLoadingCustomers ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading customers...</p>
                        : filteredCustomers.length ? filteredCustomers.map((customer: any) => <button key={customer.id} type="button" role="option" aria-selected={customer.id === form.customerId} className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => { const addresses = customerAddresses(customer); const address = addresses.length === 1 ? addresses[0] : null; setForm({ ...form, customerId: customer.id, city: address?.city || '', area: address?.area || '', address: address?.address || '' }); setSelectedCustomerAddressIndex(address ? '0' : ''); setCustomerPickerOpen(false); setCustomerSearch('') }}>
                          <span className="block font-medium">{customer.user?.name || 'Unnamed customer'}</span>
                          <span className="block text-xs text-muted-foreground">{customer.user?.email || customer.area || customer.city || 'No contact details'}</span>
                        </button>)
                        : <p className="px-2 py-3 text-sm text-muted-foreground">No matching customers.</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>}
              {requiresAddressSelection && <div className="grid gap-2">
                <Label>Service Address</Label>
                <Select value={selectedCustomerAddressIndex} onValueChange={value => { const address = selectedCustomerAddresses[Number(value)]; setSelectedCustomerAddressIndex(value); setForm({ ...form, city: address.city || '', area: address.area || '', address: address.address || '' }) }}>
                  <SelectTrigger><SelectValue placeholder="Select one saved address" /></SelectTrigger>
                  <SelectContent>{selectedCustomerAddresses.map((address: any, index: number) => <SelectItem key={index} value={String(index)}>{address.label || `Address ${index + 1}`} — {[address.area, address.city, address.address].filter(Boolean).join(', ')}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select one address for this booking.</p>
              </div>}
              <div className="grid gap-2"><Label>Select Services (At least 1 required)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border/60 rounded-lg p-2.5 bg-background">
                  {isLoadingServices ? <p className="col-span-full p-2 text-sm text-muted-foreground">Loading services...</p> : services.length ? services.map((s: any) => {
                    const isSelected = form.serviceIds.includes(s.id)
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          const next = isSelected
                            ? form.serviceIds.filter(id => id !== s.id)
                            : [...form.serviceIds, s.id]
                          const serviceOptions = { ...form.serviceOptions }
                          if (isSelected) delete serviceOptions[s.id]
                          else serviceOptions[s.id] = false
                          setForm({ ...form, serviceIds: next, serviceOptions })
                        }}
                        className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 font-medium shadow-sm'
                            : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate">{s.name}</span>
                        </div>
                        <span className="font-semibold shrink-0 ml-1">{currency} {s.baseRate}/hr</span>
                      </div>
                    )
                  }) : <p className="col-span-full p-2 text-sm text-muted-foreground">No services available for this account.</p>}
                </div>
                {form.serviceIds.length === 0 && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Please select at least one service.</p>
                )}
                {form.serviceIds.length > 0 && <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-xs font-semibold">Choose a price option for each service</p>
                  {services.filter((service: any) => form.serviceIds.includes(service.id)).map((service: any) => <div key={service.id} className="grid gap-2 rounded-md bg-background p-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <span className="text-xs font-semibold">{service.name}</span>
                    <div className="grid min-w-0 grid-cols-1 gap-2 min-[400px]:grid-cols-2" role="radiogroup" aria-label={`${service.name} materials option`}>
                      <Button type="button" size="sm" variant={!form.serviceOptions[service.id] ? 'default' : 'outline'} className={`min-h-11 min-w-0 w-full whitespace-normal px-2 text-xs leading-tight ${!form.serviceOptions[service.id] ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => setForm({ ...form, serviceOptions: { ...form.serviceOptions, [service.id]: false } })}>Without materials<br />{currency} {service.baseRate}/hr</Button>
                      <Button type="button" size="sm" variant={form.serviceOptions[service.id] ? 'default' : 'outline'} className={`min-h-11 min-w-0 w-full whitespace-normal px-2 text-xs leading-tight ${form.serviceOptions[service.id] ? 'bg-teal-600 hover:bg-teal-700' : ''}`} onClick={() => setForm({ ...form, serviceOptions: { ...form.serviceOptions, [service.id]: true } })}>With materials<br />{currency} {service.withMaterialsRate}/hr</Button>
                    </div>
                  </div>)}
                </div>}
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Assigned Staff Count</Label>
                  <div className="relative">
                    <Input aria-label="Assigned staff count" inputMode="numeric" readOnly value={form.employeeCount} className="h-12 px-14 text-center text-base font-semibold" />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove one assigned staff member" disabled={form.employeeCount <= 1} className="absolute inset-y-0 left-0 h-12 w-12 rounded-r-none" onClick={() => { const employeeCount = Math.max(1, form.employeeCount - 1); setForm({ ...form, employeeCount, preferredEmployeeIds: form.preferredEmployeeIds.slice(0, employeeCount) }) }}><Minus className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Add one assigned staff member" className="absolute inset-y-0 right-0 h-12 w-12 rounded-l-none" onClick={() => setForm({ ...form, employeeCount: form.employeeCount + 1 })}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
              </>}
              {bookingStep === 1 && <>
              <div className="grid gap-2 border-t border-border/50 pt-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Schedule Type</Label>
                <Select value={form.bookingType} onValueChange={v => setForm({ ...form, bookingType: v })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Schedule Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-Time Booking</SelectItem>
                    <SelectItem value="multiple_dates">Multiple Specific Dates</SelectItem>
                    <SelectItem value="daily_recurring">Daily Recurring (Every Day)</SelectItem>
                    <SelectItem value="weekly_recurring">Selected Weekdays Recurring</SelectItem>
                    <SelectItem value="selected_weekdays_one_time">Selected Weekdays (One-Time Week)</SelectItem>
                    <SelectItem value="long_term">Long-Term Schedule (Weeks/Months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.bookingType === 'one_time' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="grid gap-2"><Label>Date</Label><Input type="date" min={minimumBookingDate} value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>From Time</Label><Input type="time" min={earliestStartTime} max={lastWorkingTime} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>To Time</Label><Input type="time" min={form.startTime || earliestStartTime} max={lastWorkingTime} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
                </div>
              ) : form.bookingType === 'multiple_dates' ? (
                <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border/40 text-xs">
                  <div className="flex gap-2 items-end">
                    <div className="grid flex-1 gap-1"><Label>Add booking date</Label><Input type="date" min={minimumBookingDate} value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="h-11 sm:h-9" /></div>
                    <Button type="button" size="sm" className="h-8" disabled={!form.scheduledDate || form.scheduledDate < minimumBookingDate || form.selectedDates.includes(form.scheduledDate)} onClick={() => setForm({ ...form, selectedDates: [...form.selectedDates, form.scheduledDate], scheduledDate: '' })}>{form.selectedDates.includes(form.scheduledDate) ? 'Added' : 'Add'}</Button>
                  </div>
                  {form.scheduledDate && form.selectedDates.includes(form.scheduledDate) && <p className="text-xs text-muted-foreground">This date is already added. Choose another date or remove it below.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {form.selectedDates.length === 0 ? <span className="text-muted-foreground">Select one or more dates.</span> : form.selectedDates.map(date => <Button key={date} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setForm({ ...form, selectedDates: form.selectedDates.filter(value => value !== date) })}>{date} ×</Button>)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1"><Label>From Time</Label><Input type="time" min={earliestStartTime} max={lastWorkingTime} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="h-11 sm:h-9" /></div>
                    <div className="grid gap-1"><Label>To Time</Label><Input type="time" min={form.startTime || earliestStartTime} max={lastWorkingTime} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="h-11 sm:h-9" /></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border/40 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1"><Label className="text-[11px]">Start Date</Label><Input type="date" min={minimumBookingDate} value={form.startDate || form.scheduledDate} onChange={e => setForm({ ...form, startDate: e.target.value, scheduledDate: e.target.value })} className="h-8 text-xs" /></div>
                    <div className="grid gap-1"><Label className="text-[11px]">End Date</Label><Input type="date" min={form.startDate || minimumBookingDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="h-8 text-xs" /></div>
                  </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="grid gap-1"><Label className="text-[11px]">From Time</Label><Input type="time" min={earliestStartTime} max={lastWorkingTime} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="h-8 text-xs" /></div>
                      <div className="grid gap-1"><Label className="text-[11px]">To Time</Label><Input type="time" min={form.startTime || earliestStartTime} max={lastWorkingTime} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="h-8 text-xs" /></div>
                  </div>
                  {(form.bookingType === 'weekly_recurring' || form.bookingType === 'selected_weekdays_one_time' || form.bookingType === 'long_term') && (
                    <div className="space-y-1">
                      <Label>Select Active Weekdays</Label>
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAY_LABELS.map((label, dayIdx) => {
                          const isChecked = form.selectedWeekdays.includes(dayIdx)
                          return (
                            <Button
                              key={label}
                              type="button"
                              size="sm"
                              variant={isChecked ? "default" : "outline"}
                              className={`h-7 px-2.5 text-xs ${isChecked ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                              onClick={() => {
                                const next = isChecked
                                  ? form.selectedWeekdays.filter(d => d !== dayIdx)
                                  : [...form.selectedWeekdays, dayIdx]
                                setForm({ ...form, selectedWeekdays: next })
                              }}
                            >
                              {label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isTimeInvalid && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
                  Bookings require at least {MIN_BOOKING_DURATION_HOURS} hours. Choose a later end time.
                </div>
              )}
              </>}
              {bookingStep >= 2 && <>
              {bookingStep === 2 && <>
              {/* Preferred Employee Selection (Optional) */}
              <div className="grid gap-2 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasPreferredEmployee"
                      checked={form.hasPreferredEmployee}
                      onChange={e => {
                        const checked = e.target.checked
                        setForm({
                          ...form,
                          hasPreferredEmployee: checked,
                          preferredEmployeeIds: checked ? form.preferredEmployeeIds : [],
                        })
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <Label htmlFor="hasPreferredEmployee" className="text-xs font-semibold cursor-pointer">
                      Select Cleaners Now (Optional)
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">Directly assigns on confirmation</span>
                </div>

                {form.hasPreferredEmployee && (
                  <div className="space-y-2 pt-1">
                    <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" aria-expanded={employeePickerOpen} className="h-9 w-full justify-between text-xs font-normal">
                          {form.preferredEmployeeIds.length ? `${form.preferredEmployeeIds.length} of ${form.employeeCount} cleaners selected` : 'Search and select cleaners...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                        <Input autoFocus value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Search cleaner..." />
                        <div className="mt-2 max-h-52 overflow-y-auto" role="listbox">
                          {(availability?.availableEmployees || []).filter((employee: any) => `${employee.name} ${employee.employeeCode}`.toLowerCase().includes(employeeSearch.trim().toLowerCase())).map((employee: any) => {
                            const selected = form.preferredEmployeeIds.includes(employee.id)
                            const atLimit = !selected && form.preferredEmployeeIds.length >= form.employeeCount
                            return <button key={employee.id} type="button" role="option" aria-selected={selected} disabled={atLimit} className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setForm({ ...form, preferredEmployeeIds: selected ? form.preferredEmployeeIds.filter(id => id !== employee.id) : [...form.preferredEmployeeIds, employee.id] }); setEmployeePickerOpen(false) }}>
                              <input type="checkbox" checked={selected} readOnly className="h-4 w-4" />
                              <span className="flex-1">{employee.name} ({employee.employeeCode})</span>
                              <span className="text-xs text-muted-foreground">{employee.ratingFormatted}</span>
                            </button>
                          })}
                          {!isAvailLoading && !(availability?.availableEmployees || []).some((employee: any) => `${employee.name} ${employee.employeeCode}`.toLowerCase().includes(employeeSearch.trim().toLowerCase())) && <p className="px-2 py-3 text-sm text-muted-foreground">No available cleaners found.</p>}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">{form.preferredEmployeeIds.length} of {form.employeeCount} cleaners selected; the system can assign the remaining slots.</p>
                    {availabilityError && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{availabilityError instanceof Error ? availabilityError.message : 'Failed to check cleaner availability'}</div>}
                    {availability?.suggestedAlternatives?.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">Suggested Cleaners</p>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Highest rating first</span>
                        </div>
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {availability.suggestedAlternatives.map((employee: any) => {
                            const selected = form.preferredEmployeeIds.includes(employee.id)
                            const atLimit = !selected && form.preferredEmployeeIds.length >= form.employeeCount
                            return (
                              <div key={employee.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-2 text-xs">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-semibold">{employee.name}</span>
                                    <span className="text-amber-600">{employee.ratingCount ? `★ ${employee.averageRating.toFixed(1)}` : 'New · No ratings'}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                                    <span>✓ Same tenant</span><span>✓ Active</span><span>✓ Not on leave</span><span>✓ No schedule conflict</span>
                                  </div>
                                </div>
                                <Button type="button" size="sm" variant={selected ? 'secondary' : 'outline'} disabled={atLimit} className="min-h-11 shrink-0 text-xs" onClick={() => { setForm({ ...form, preferredEmployeeIds: selected ? form.preferredEmployeeIds.filter(id => id !== employee.id) : [...form.preferredEmployeeIds, employee.id] }); setEmployeePickerOpen(false) }}>
                                  {selected ? 'Selected' : 'Select'}
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div className="hidden">
                    <Select
                      value={form.preferredEmployeeId}
                      onValueChange={v => setForm({ ...form, preferredEmployeeId: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Choose preferred cleaner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availability?.availableEmployees?.length ? (
                          availability.availableEmployees.map((emp: any) => (
                            <SelectItem key={emp.id} value={emp.id} disabled={!emp.isAvailable}>
                              <span className="flex items-center justify-between w-full gap-2">
                                <span>{emp.name} ({emp.employeeCode})</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  emp.isAvailable
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : emp.isLeave
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                  {emp.isAvailable ? '✓ Available' : emp.reason}
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        ) : <SelectItem value="none" disabled>{isAvailLoading ? 'Checking eligible cleaners...' : 'No eligible cleaners for this booking slot'}</SelectItem>}
                      </SelectContent>
                    </Select>
                    </div>

                    {form.preferredEmployeeId && (
                      (() => {
                        const selectedEmpStatus = availability?.allEmployeesStatus?.find((e: any) => e.id === form.preferredEmployeeId)
                        if (!selectedEmpStatus) return null
                        if (selectedEmpStatus.isAvailable) {
                          return (
                            <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                              ✓ {selectedEmpStatus.name} is available for this slot and will be directly assigned upon confirmation.
                            </div>
                          )
                        } else {
                          return (
                            <div className="space-y-2">
                              <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
                                ⚠️ <strong>{selectedEmpStatus.name}</strong> is unavailable for this time slot ({selectedEmpStatus.reason}). Conflicting assignment is not allowed.
                              </div>

                              {/* Alternative Employee Suggestions (Prompt 06) */}
                              {availability?.suggestedAlternatives && availability.suggestedAlternatives.length > 0 && (
                                <div className="space-y-2 pt-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                    <span>Recommended Available Alternatives</span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Ranked by Rating & Workload</span>
                                  </p>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {availability.suggestedAlternatives.map((alt: any) => (
                                      <div
                                        key={alt.id}
                                        onClick={() => setForm({ ...form, preferredEmployeeId: alt.id })}
                                        className="flex items-center justify-between p-2 rounded-lg border border-border/60 hover:border-emerald-500 bg-background hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer text-xs group"
                                      >
                                        <div>
                                          <p className="font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                                            {alt.displayText}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground">{alt.detailText}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white">
                                          Select
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        }
                      })()
                    )}
                  </div>
                )}
              </div>
              </>}

              {bookingStep === 3 && !isTimeInvalid && hasScheduleDates && form.startTime && form.endTime && duration >= MIN_BOOKING_DURATION_HOURS && form.serviceIds.length > 0 && (
                <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm sm:p-4">
                  <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
                    <span className="text-muted-foreground font-medium">Calculated Slot & Duration</span>
                    <Badge variant="secondary" className="w-fit whitespace-normal bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {duration} {duration === 1 ? 'Hour' : 'Hours'} ({form.employeeCount} {form.employeeCount === 1 ? 'Cleaner' : 'Cleaners'})
                    </Badge>
                  </div>
                  <div className="space-y-3 border-t border-border/40 pt-3">
                    <span className="text-muted-foreground font-medium block text-[11px] uppercase tracking-wider">Service Charges</span>
                    {multiPricing.items.map(it => (
                      <div key={it.serviceId} className="grid gap-1 rounded-lg bg-background p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <span className="min-w-0 text-xs leading-5 text-muted-foreground">
                          • {it.serviceName} ({currency} {it.hourlyRate}/hr × {it.employeeCount} cleaner{it.employeeCount === 1 ? '' : 's'} × {it.hours}h)
                        </span>
                        <span className="text-base font-bold sm:text-sm">{currency} {it.totalAmount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center font-medium pt-0.5 text-xs text-muted-foreground">
                      <span>Total Labour Charges</span>
                      <span className="font-semibold text-foreground">{currency} {multiPricing.labourSubtotal.toLocaleString()}</span>
                    </div>

                    {/* Itemized Materials Breakdown */}
                    {multiPricing.materials.length > 0 && (
                      <div className="pt-2 border-t border-border/40 space-y-1">
                        <span className="text-muted-foreground font-medium block text-[11px] uppercase tracking-wider">Materials Breakdown</span>
                        {multiPricing.materials.map((mat, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">• {mat.name || 'Material'} ({mat.quantity} {mat.unit} × {currency} {mat.unitPrice})</span>
                            <span className="font-semibold">{currency} {mat.totalAmount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center font-medium pt-0.5 text-xs text-muted-foreground">
                          <span>Total Material Charges</span>
                          <span className="font-semibold text-foreground">{currency} {multiPricing.materialsSubtotal.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {multiPricing.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Tax ({(multiPricing.taxRate * 100).toLocaleString()}%)</span>
                        <span className="font-semibold text-foreground">{currency} {multiPricing.taxAmount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex items-end justify-between gap-3 border-t border-border/40 pt-3 font-bold">
                      <span>Final Booking Total</span>
                      <span className="text-xl text-emerald-700 dark:text-emerald-400">{currency} {multiPricing.netAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 border-t border-border/40 pt-3 sm:flex sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Staff Availability for Slot</span>
                    {isAvailLoading ? (
                      <span className="text-muted-foreground animate-pulse">Checking availability...</span>
                    ) : availability ? (
                      <Badge variant={availability.availableCount >= form.employeeCount ? "outline" : "destructive"} className={`w-fit whitespace-normal ${availability.availableCount >= form.employeeCount ? "border-emerald-300 text-emerald-700 bg-emerald-50/50" : ""}`}>
                        {availability.availableCount >= form.employeeCount ? `✓ ${availability.availableCount} of ${availability.totalEmployees} Available` : `⚠️ Only ${availability.availableCount} Cleaners Available (Need ${form.employeeCount})`}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Select date & times</span>
                    )}
                  </div>
                </div>
              )}
              {bookingStep === 2 && <><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Area</Label><Input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Preferred payment method</Label><Select value={form.preferredPaymentMethod} onValueChange={preferredPaymentMethod => setForm({ ...form, preferredPaymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Pay Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Payment remains pending until cash is received or the bank transfer is verified.</p></div>
              <div className="grid gap-2"><Label htmlFor="booking-notes">Notes</Label><Textarea id="booking-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div></>}
              </>}
            </div>
            {(bookingError || (bookingStep === 3 && bookingValidationError)) && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{bookingError || bookingValidationError}</div>}
            <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_-16px_rgba(0,0,0,.4)] [&_button]:min-h-11 [&_button]:w-full sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0 sm:shadow-none sm:[&_button]:w-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              {bookingStep > 0 && <Button variant="outline" onClick={() => setBookingStep(bookingStep - 1)}>Back</Button>}
              {bookingStep < 3 ? (
                <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!canContinueBooking} onClick={() => setBookingStep(bookingStep + 1)}>Continue</Button>
              ) : (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={!canCreateBooking || createMut.isPending}
                  onClick={() => {
                    setBookingError(null)
                    if (bookingValidation.success) createMut.mutate(bookingValidation.data)
                  }}
                >
                  {createMut.isPending ? 'Creating...' : 'Create Booking'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabs: Table + Calendar */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {currentRole === 'cleaner' && <div className="flex gap-2 mb-3">
          <Button size="sm" variant={cleanerDateScope === 'today' ? 'default' : 'outline'} className={cleanerDateScope === 'today' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setCleanerDateScope('today')}>Today&apos;s Bookings</Button>
          <Button size="sm" variant={cleanerDateScope === 'all' ? 'default' : 'outline'} className={cleanerDateScope === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setCleanerDateScope('all')}>All Assigned</Button>
        </div>}
        {currentRole === 'driver' && <div className="flex flex-wrap gap-2 mb-3">
          {([['today', "Today's Bookings"], ['completed', "Today's Completed"], ['pending', "Today's Pending"], ['upcoming', 'Upcoming Pickups / Drop-offs']] as const).map(([scope, label]) => <Button key={scope} size="sm" variant={driverScope === scope ? 'default' : 'outline'} className={driverScope === scope ? 'bg-violet-600 hover:bg-violet-700' : ''} onClick={() => setDriverScope(scope)}>{label}</Button>)}
        </div>}
        {/* Status Filter Badges */}
        <motion.div layout className="flex flex-wrap gap-1.5 mb-3">
          {(['all', 'pending_assignment', 'assigned', 'scheduled', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show'] as const).map(s => {
            const count = s === 'all' ? statusCounts.total : statusCounts[s]
            return (
              <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm"
                className={`text-xs h-7 ${statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ({count})
              </Button>
            )
          })}
        </motion.div>

        {/* Search & Tab switcher */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search bookings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {currentRole === 'admin' && activeTab === 'table' && <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap" aria-label="Filter bookings by date">
            <div className="grid min-w-0 gap-1">
              <Label htmlFor="booking-date-from" className="text-xs text-muted-foreground">From</Label>
              <Input id="booking-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="h-11 w-full min-w-0 sm:h-9 sm:w-auto" />
            </div>
            <div className="grid min-w-0 gap-1">
              <Label htmlFor="booking-date-to" className="text-xs text-muted-foreground">To</Label>
              <Input id="booking-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="h-11 w-full min-w-0 sm:h-9 sm:w-auto" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => { const today = format(new Date(), 'yyyy-MM-dd'); setDateFrom(today); setDateTo(today) }}>Today</Button>
            {(dateFrom || dateTo) && <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-9" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Button>}
          </div>}
          <TabsList className="ml-auto">
            <TabsTrigger value="table" className="gap-1.5 text-xs sm:text-sm">
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Table Tab */}
        <TabsContent value="table" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs font-semibold"><SortableHeader col={'bookingNo'}>Booking</SortableHeader></TableHead>
                        <TableHead className="text-xs font-semibold">Customer</TableHead>
                        <TableHead className="text-xs font-semibold hidden lg:table-cell">Service</TableHead>
                        <TableHead className="text-xs font-semibold"><SortableHeader col={'scheduledDate'}>Date</SortableHeader></TableHead>
                        <TableHead className="text-xs font-semibold hidden md:table-cell">Time</TableHead>
                        <TableHead className="text-xs font-semibold hidden md:table-cell">Duration</TableHead>
                        <TableHead className="text-xs font-semibold"><SortableHeader col={'netAmount'}>Amount</SortableHeader></TableHead>
                        <TableHead className="text-xs font-semibold"><SortableHeader col={'status'}>Status</SortableHeader></TableHead>
                        <TableHead className="text-xs font-semibold hidden xl:table-cell">Team / Driver</TableHead>
                        <TableHead className="text-xs font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Calendar className="h-8 w-8 text-muted-foreground/40" />
                            <span>No bookings found</span>
                          </div>
                        </TableCell></TableRow>
                      ) : (
                        <AnimatePresence>
                          {sortedBookings.map((b: any, idx: number) => (
                            <motion.tr
                              key={b.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: idx * 0.03 }}
                              className={`border-l-4 ${statusBorderColors [b.status] || 'border-l-gray-200'} ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'} hover:bg-muted/30 transition-colors cursor-pointer`}
                              onClick={() => handleRowClick(b)}
                            >
                              <TableCell className="font-mono text-xs font-medium">{b.bookingNo}</TableCell>
                              <TableCell className="font-medium">{b.customer?.user?.name}</TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                {b.items && b.items.length > 0 ? (
                                  <span>{b.items.map((i: any) => i.service?.name || 'Service').join(', ')} ({b.employeeCount || 1} Cleaner{(b.employeeCount || 1) === 1 ? '' : 's'})</span>
                                ) : (
                                  <span>{b.service?.name} ({b.employeeCount || 1} Cleaner{(b.employeeCount || 1) === 1 ? '' : 's'})</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{format(parseISO(b.scheduledDate), 'MMM dd')}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm">{b.startTime}{b.endTime ? ` - ${b.endTime}` : ` - ${calculateEndTimeFromDuration(b.startTime, b.duration)}`}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm font-medium text-emerald-700 dark:text-emerald-400">{b.duration}h</TableCell>
                              <TableCell className="font-semibold">{currency} {b.netAmount.toLocaleString()}</TableCell>
                              <TableCell>
                                {(() => {
                                  const fin = calculateBookingFinancials(b)
                                  const overdue = isBookingOverdue(b)
                                  return (
                                    <div className="space-y-1">
                                      {overdue && (
                                        <div className="max-w-52 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                                          <Badge className="mb-1 bg-red-600 text-[10px] font-semibold text-white hover:bg-red-600">
                                            <TriangleAlert className="mr-1 h-3 w-3" />Overdue
                                          </Badge>
                                          <p className="text-[11px] leading-4">{overdueRecommendation(b.status)}</p>
                                        </div>
                                      )}
                                      <div>
                                        {!isTerminalBookingStatus(b.status) && (b.status === 'pending_assignment' || !b.assignments || b.assignments.length < b.employeeCount || !b.driverId) ? (
                                          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 font-semibold text-xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 inline-block animate-pulse" />
                                            Pending Assignment
                                          </Badge>
                                        ) : (
                                          <Badge className={`${statusColors[b.status] || ''} text-xs`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColors[b.status]} mr-1.5 inline-block`} />
                                            {statusDisplayLabels[b.status] || b.status.replace(/_/g, ' ')}
                                          </Badge>
                                        )}
                                      </div>
                                      {b.status === 'completed' && (
                                        <div>
                                          <Badge className={`${paymentStatusColors[fin.paymentStatus] || 'bg-muted'} text-[10px] font-semibold border px-1.5 py-0.5`}>
                                            {paymentStatusLabels[fin.paymentStatus] || fin.paymentStatus.replace(/_/g, ' ')}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </TableCell>
                              <TableCell className="hidden xl:table-cell text-sm">
                                <div className="space-y-1"><p className="font-medium">{b.assignments?.length ? b.assignments.map((a: any) => a.employee?.user?.name || a.employee?.employeeCode).join(', ') : <span className="text-amber-600 text-xs">Cleaners needed</span>}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Truck className="h-3 w-3"/>{b.driver?.user?.name || <span className="text-amber-600">Driver needed</span>}</p></div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const fin = calculateBookingFinancials(b)
                                  return (
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" aria-label={`View booking ${b.bookingNo}`} className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600" onClick={() => handleRowClick(b)}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                      {currentRole === 'driver' && b.latitude != null && b.longitude != null && <Button size="sm" variant="outline" className="min-h-11 border-blue-300 text-xs text-blue-700 hover:bg-blue-50" aria-label={`Open directions for booking ${b.bookingNo}`} onClick={() => openDirections(b)}><Navigation className="mr-1 h-3.5 w-3.5" />Directions</Button>}
                                      {currentRole === 'admin' && ['pending_assignment', 'assigned', 'scheduled'].includes(canonicalStatus(b.status)) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-7 px-2 border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium"
                                          onClick={() => {
                                            setAssigningBooking(b)
                                            setSelectedAssignEmpIds(b.assignments?.map((a: any) => a.employeeId) || [])
                                            setSelectedAssignDriverId(b.driverId || '')
                                          }}
                                        >
                                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                                          {b.driverId && b.assignments?.length === b.employeeCount ? 'Manage Team' : 'Assign Team'}
                                        </Button>
                                      )}
                                      {b.status === 'pending_assignment' && (currentRole === 'admin' || currentRole === 'customer') && (
                                        <>
                                          <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => updateMut.mutate({ id: b.id, status: 'cancelled', cancellationReason: `Cancelled by ${currentRole}` })}>Cancel</Button>
                                        </>
                                      )}
                                      {currentRole === 'admin' && b.status === 'assigned' && (
                                        <Button size="sm" variant="outline" disabled={(b.assignments?.length || 0) < b.employeeCount || !b.driverId} className="text-xs h-7 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handleStatusChange(b.id, 'scheduled')}>Confirm</Button>
                                      )}
                                      {currentRole === 'driver' && (b.status === 'scheduled' || b.status === 'confirmed') && (
                                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={() => handleStatusChange(b.id, 'on_the_way')}>On the Way</Button>
                                      )}
                                      {currentRole === 'admin' && (b.status === 'scheduled' || b.status === 'confirmed') && <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => updateMut.mutate({ id: b.id, status: 'no_show', noShowReason: 'Customer did not attend', noShowParty: 'customer' })}>No Show</Button>}
                                      {(currentRole === 'admin' || currentRole === 'cleaner') && b.status === 'on_the_way' && (
                                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => handleStatusChange(b.id, 'in_progress')}>Start</Button>
                                      )}
                                      {currentRole === 'cleaner' && b.status === 'in_progress' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-7 px-2 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-semibold"
                                          onClick={() => setCleanerCompleteBookingConfirm(b)}
                                        >
                                          Complete Booking
                                        </Button>
                                      )}
                                      {currentRole === 'cleaner' && b.customer?.phone && <Button asChild size="sm" variant="outline" className="min-h-11 border-emerald-300 text-emerald-700 hover:bg-emerald-50"><a href={`tel:${b.customer.phone}`} aria-label={`Call customer at ${b.customer.phone}`}><Phone className="h-3.5 w-3.5 mr-1" />Call Customer</a></Button>}
                                      {currentRole === 'cleaner' && <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setIssueBooking(b)}><MessageSquareWarning className="h-3.5 w-3.5 mr-1" />Report Issue</Button>}
                                      {b.status === 'completed' && (
                                        <>
                                          {currentRole === 'customer' && fin.canSelectPaymentMethod && (
                                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold" onClick={() => { setPaymentBooking(b); setPaymentMethod('cash'); setPaymentFields(prev => ({ ...prev, transferAmount: String(calculateBookingFinancials(b).remainingPayableAmount), transferDate: format(new Date(), 'yyyy-MM-dd') })); }}>
                                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                                              Pay / Select Method
                                            </Button>
                                          )}
                                          {currentRole === 'cleaner' && fin.paymentStatus === 'cash_selected' && fin.remainingPayableAmount > 0 && (
                                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold shadow-sm" onClick={() => setCleanerCashBooking(b)}>
                                              <Banknote className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                              Mark Cash Received ({currency} {fin.remainingPayableAmount})
                                            </Button>
                                          )}
                                          {(currentRole === 'cleaner' || currentRole === 'admin') && b.invoices?.[0]?.payments?.some((p: any) => p.method === 'cash' && ['verified', 'paid'].includes(p.status)) && (
                                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 border-emerald-300 font-bold text-xs">
                                              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600 inline" />
                                              Cash Received {(() => { const cash = b.invoices?.[0]?.payments?.find((p: any) => p.method === 'cash' && ['verified', 'paid'].includes(p.status)); const receivedAt = cash?.receivedAt || cash?.verifiedAt; return receivedAt ? `(${format(parseISO(receivedAt), 'MMM dd, HH:mm')})` : '' })()}
                                            </Badge>
                                          )}
                                          {currentRole === 'admin' && (fin.paymentStatus === 'bank_transfer_submitted' || fin.paymentStatus === 'under_verification') && (
                                            <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100 font-semibold" onClick={() => setReviewingBankTransferBooking(b)}>
                                              <Building2 className="h-3.5 w-3.5 mr-1" />
                                              Review Transfer
                                            </Button>
                                          )}
                                          {currentRole === 'admin' && fin.paymentStatus !== 'payment_pending' && (
                                            <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-amber-700 hover:bg-amber-50" title="Reopen payment to allow customer re-selection" onClick={() => reopenPaymentMut.mutate({ bookingId: b.id })}>
                                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                              Reopen Pay
                                            </Button>
                                          )}
                                          {(currentRole === 'customer' || (currentRole === 'admin' && b.rating)) && <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setRatingBooking(b)}><Star className="h-3 w-3 mr-1" />{b.rating ? 'View Rating' : 'Rate'}</Button>}
                                        </>
                                      )}
                                      {isEndedStatus(b.status) && <span className="px-1 text-xs font-medium text-muted-foreground">{statusDisplayLabels[canonicalStatus(b.status)]}</span>}
                                      {currentRole === 'admin' && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="icon" variant="ghost" aria-label={`Delete booking ${b.bookingNo}`} className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Booking</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Are you sure you want to delete booking {b.bookingNo}? This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => deleteMut.mutate(b.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      )}
                                    </div>
                                  )
                                })()}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              {/* Calendar Header / Navigation */}
              <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
                <div className="grid w-full grid-cols-[44px_1fr_44px] items-center gap-2 sm:flex sm:w-auto">
                  <Button variant="outline" size="icon" aria-label="Previous month" className="h-11 w-11 sm:h-8 sm:w-8" onClick={goToPrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-center text-base font-semibold sm:ml-2 sm:min-w-[160px] sm:text-lg">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h2>
                  <Button variant="outline" size="icon" aria-label="Next month" className="h-11 w-11 sm:h-8 sm:w-8" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="col-span-3 mx-auto min-h-11 text-sm text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 sm:col-span-1 sm:ml-1 sm:h-7 sm:min-h-0 sm:px-2 sm:text-xs" onClick={goToToday}>Today</Button>
                </div>
              </div>

              <div className="hidden sm:block">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                    {label}
                  </div>
                ))}
              </div>

              {/* Calendar Grid with animated month transition */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMonth.toISOString().slice(0, 7)}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-7"
                >
                  {calendarDays.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayBookings = bookingsByDate[dateKey] || []
                    const inCurrentMonth = isSameMonth(day, currentMonth)
                    const isToday = isSameDay(day, new Date())
                    const hasBookings = dayBookings.length > 0

                    // Get up to 3 unique statuses for dots
                    const dotStatuses = dayBookings
                      .slice(0, 3)
                      .map((b: any) => b.status)

                    return (
                      <div
                        key={dateKey}
                        className={`
                          relative min-h-[72px] sm:min-h-[88px] border-t border-r border-b border-l border-border/40 p-1.5 sm:p-2
                          transition-colors ${!inCurrentMonth ? 'bg-muted/20 opacity-40' : ''}
                          ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''}
                          ${hasBookings && inCurrentMonth && !isToday ? 'hover:bg-muted/40' : ''}
                        `}
                      >
                        <button
                          ref={(el) => {
                            // We store ref for popover trigger manually
                          }}
                          className={`absolute inset-0 z-10 flex h-full w-full items-start justify-center rounded-none pt-2 text-sm font-medium
                            ${isToday ? 'font-bold text-emerald-700 dark:text-emerald-300' : ''}
                            ${!inCurrentMonth ? 'text-muted-foreground/50' : ''}
                            ${inCurrentMonth && !isToday ? 'text-foreground' : ''}
                            ${hasBookings ? 'cursor-pointer' : 'cursor-default'}
                          `}
                          onClick={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement
                            handleDayClick(day, btn)
                          }}
                          disabled={!hasBookings}
                        >
                          {format(day, 'd')}
                        </button>

                        {/* Booking dots */}
                        {hasBookings && (
                          <div className="pointer-events-none absolute inset-x-1 bottom-2 z-20 flex items-center justify-center gap-1">
                            {dotStatuses.map((status, dotIdx) => (
                              <span
                                key={dotIdx}
                                className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${calendarStatusDotColors [status] || 'bg-gray-400'}`}
                              />
                            ))}
                            {dayBookings.length > 3 && (
                              <span className="text-[9px] text-muted-foreground leading-none ml-0.5">
                                +{dayBookings.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
              </div>

              {/* Phone calendar: readable agenda instead of squeezed day cells */}
              <div className="space-y-3 sm:hidden">
                <div className="grid grid-cols-7 gap-1" aria-label={`Bookings calendar for ${format(currentMonth, 'MMMM yyyy')}`}>
                  {WEEKDAY_LABELS.map(label => <span key={label} className="py-1 text-center text-xs font-semibold text-muted-foreground">{label.slice(0, 1)}</span>)}
                  {calendarDays.map(day => {
                    const dayBookings = bookingsByDate[format(day, 'yyyy-MM-dd')] || []
                    const inMonth = isSameMonth(day, currentMonth)
                    const selected = popoverDay && isSameDay(day, popoverDay)
                    return <button key={day.toISOString()} type="button" disabled={!dayBookings.length} aria-label={`${format(day, 'MMMM d')}, ${dayBookings.length} bookings`} onClick={() => handleDayClick(day)} className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${!inMonth ? 'opacity-30' : ''} ${selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-border/60'} disabled:cursor-default`}>
                      <span className="font-semibold">{format(day, 'd')}</span>
                      {dayBookings.length > 0 && <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">{dayBookings.length}</span>}
                    </button>
                  })}
                </div>
                {!popoverDay && <p className="rounded-lg bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">Tap a numbered day to view its bookings.</p>}
                {calendarDays.filter(day => popoverDay && isSameDay(day, popoverDay)).map(day => {
                  const dayBookings = bookingsByDate[format(day, 'yyyy-MM-dd')] || []
                  return <section key={day.toISOString()} className="overflow-hidden rounded-xl border bg-background">
                    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2.5">
                      <h3 className="text-sm font-semibold">{format(day, 'EEEE, MMM d')}</h3>
                      <span className="text-xs text-muted-foreground">{dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="divide-y">
                      {dayBookings.map((booking: any) => <button key={booking.id} type="button" className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40" onClick={() => handleRowClick(booking)}>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${calendarStatusDotColors[booking.status] || 'bg-gray-400'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{booking.customer?.user?.name || booking.bookingNo}</span>
                          <span className="block truncate text-xs text-muted-foreground">{booking.startTime} · {booking.service?.name || booking.items?.map((item: any) => item.service?.name).filter(Boolean).join(', ')}</span>
                        </span>
                        <Badge className={`${statusColors[booking.status] || ''} hidden shrink-0 text-xs min-[360px]:inline-flex`}>{statusDisplayLabels[booking.status] || booking.status.replace(/_/g, ' ')}</Badge>
                      </button>)}
                    </div>
                  </section>
                })}
                {!calendarDays.some(day => isSameMonth(day, currentMonth) && (bookingsByDate[format(day, 'yyyy-MM-dd')] || []).length > 0) && <div className="rounded-xl border border-dashed px-4 py-12 text-center"><Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">No bookings this month</p></div>}
              </div>

              {/* Legend */}
              <div className="mt-5 hidden flex-wrap items-center gap-4 border-t border-border/40 pt-4 sm:flex">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
                {legendItems.map((item) => (
                  <div key={item.status} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Day Popover for Calendar */}
      {popoverDay && popoverAnchor && (
        <Popover open={!!popoverDay} onOpenChange={(open) => { if (!open) { setPopoverDay(null); setPopoverAnchor(null) } }}>
          <PopoverTrigger asChild>
            <div className="sr-only" ref={popoverAnchor as any} />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" side="top" align="start">
            {(() => {
              const dateKey = format(popoverDay, 'yyyy-MM-dd')
              const dayBookings = bookingsByDate[dateKey] || []
              return (
                <div>
                  <div className="px-3 py-2 border-b border-border/40">
                    <p className="text-sm font-semibold">{format(popoverDay, 'EEEE, MMM d yyyy')}</p>
                    <p className="text-xs text-muted-foreground">{dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {dayBookings.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No bookings</div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {dayBookings.map((b: any) => (
                          <button
                            key={b.id}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors "
                            onClick={() => {
                              setPopoverDay(null)
                              setPopoverAnchor(null)
                              handleRowClick(b)
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${calendarStatusDotColors [b.status] || 'bg-gray-400'}`} />
                              <span className="text-xs font-mono font-medium">{b.bookingNo}</span>
                              <Badge className={`${statusColors [b.status] || ''} text-[10px] ml-auto`}>
                                {statusDisplayLabels[b.status] || b.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{b.startTime} · {b.duration}h</span>
                              <span className="mx-1">·</span>
                              <span className="font-medium text-foreground truncate">{b.customer?.user?.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {b.service?.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </PopoverContent>
        </Popover>
      )}

      {/* Detail View Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-none gap-3 rounded-none border-0 p-4 text-sm sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:gap-4 sm:rounded-lg sm:border sm:p-6">
          {selectedBooking && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-8 sm:gap-3">
                  <DialogTitle className="text-lg">{selectedBooking.bookingNo}</DialogTitle>
                  <Badge className={`${statusColors [selectedBooking.status] || ''} text-xs`}>
                    {statusDisplayLabels[selectedBooking.status] || selectedBooking.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Pipeline Visual */}
              <div className="py-2 sm:py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status Pipeline</p>
                {isEndedStatus(selectedBooking.status) ? <div className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 ${selectedBooking.status === 'no_show' ? 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'}`}><XCircle className="h-6 w-6 shrink-0" /><div><p className="font-semibold">{statusDisplayLabels[canonicalStatus(selectedBooking.status)]}</p><p className="text-xs opacity-80">{selectedBooking.noShowReason || selectedBooking.cancellationReason || 'This booking is closed and requires no further action.'}</p></div></div> : <>
                <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3 sm:hidden"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Current status</p><p className="truncate text-sm font-semibold">{statusDisplayLabels[canonicalStatus(selectedBooking.status)] || selectedBooking.status.replace(/_/g, ' ')}</p></div></div>
                <div className="hidden items-center justify-between sm:flex">
                  {pipelineSteps.map((step, idx) => {
                    const currentIndex = getPipelineIndex(selectedBooking.status)
                    const isCompleted = idx <= currentIndex
                    const isCurrent = step.key === selectedBooking.status
                    const StepIcon = step.icon
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompleted && !isCurrent
                              ? 'bg-emerald-500 text-white'
                              : isCurrent
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 dark:ring-emerald-800'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            <StepIcon className="h-4 w-4" />
                          </div>
                          <span className={`text-xs font-medium ${isCurrent ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                        </div>
                        {idx < pipelineSteps.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 rounded ${
                            isCompleted && !isCurrent ? 'bg-emerald-400' : 'bg-muted'
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div></>}
              </div>

              <Separator />

              {/* Booking Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                    <p className="font-semibold text-sm">{selectedBooking.customer?.user?.name}</p>
                    {currentRole === 'cleaner' && selectedBooking.customer?.phone && <Button asChild variant="outline" className="mt-2 min-h-11 border-emerald-300 text-emerald-700 hover:bg-emerald-50"><a href={`tel:${selectedBooking.customer.phone}`} aria-label={`Call customer at ${selectedBooking.customer.phone}`}><Phone className="mr-2 h-4 w-4" />Call Customer</a></Button>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Service</p>
                    <p className="font-semibold text-sm">{selectedBooking.service?.name}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{selectedBooking.address || 'No address provided'}</p>
                      <p className="text-xs text-muted-foreground">{[selectedBooking.area, selectedBooking.city].filter(Boolean).join(', ')}</p>
                      {currentRole === 'driver' && selectedBooking.latitude != null && selectedBooking.longitude != null && <Button type="button" variant="outline" className="mt-2 min-h-11 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => openDirections(selectedBooking)}><Navigation className="mr-2 h-4 w-4" />Open directions</Button>}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-medium">{format(parseISO(selectedBooking.scheduledDate), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Time & Duration</p>
                        <p className="text-sm font-medium">{selectedBooking.startTime}{selectedBooking.endTime ? ` - ${selectedBooking.endTime}` : ` - ${calculateEndTimeFromDuration(selectedBooking.startTime, selectedBooking.duration)}`} ({selectedBooking.duration}h)</p>
                      </div>
                    </div>
                  </div>
                  {selectedBooking.notes && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                        <p className="text-sm">{selectedBooking.notes}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                    <p className="text-sm text-muted-foreground">{format(parseISO(selectedBooking.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Itemized Price Breakdown */}
              <div className="py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Itemized Price Breakdown</p>
                <div className="space-y-3 rounded-xl bg-muted/40 p-3 sm:p-4">
                  {/* Service Charges */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Service Charges</p>
                    {selectedBooking.items && selectedBooking.items.length > 0 ? (
                      selectedBooking.items.map((it: any) => (
                        <div key={it.id} className="grid gap-2 text-sm min-[360px]:grid-cols-[1fr_auto] min-[360px]:items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{it.service?.name} <Badge variant="outline" className="mt-1 text-xs min-[360px]:ml-1 min-[360px]:mt-0">{it.includesMaterials ? 'With materials' : 'Without materials'}</Badge></p>
                            <p className="text-xs text-muted-foreground">{currency} {it.hourlyRate}/hr × {it.employeeCount || selectedBooking.employeeCount || 1} staff × {it.hours || selectedBooking.duration}h</p>
                          </div>
                          <span className="text-sm font-semibold">{currency} {it.totalAmount.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{selectedBooking.service?.name} ({currency} {selectedBooking.hourlyRate}/hr × {selectedBooking.employeeCount || 1} staff × {selectedBooking.duration}h)</span>
                        <span className="font-medium">{currency} {selectedBooking.totalAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Materials Charges */}
                  {selectedBooking.materials && selectedBooking.materials.length > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Materials Charges</p>
                      {selectedBooking.materials.map((mat: any) => (
                        <div key={mat.id} className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">• {mat.name} ({mat.quantity} {mat.unit} × {currency} {mat.unitPrice})</span>
                          <span className="font-semibold">{currency} {mat.totalAmount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-medium pt-1">
                        <span className="text-muted-foreground">Total Material Charges</span>
                        <span>{currency} {(selectedBooking.materialsCost || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : selectedBooking.materialsCost > 0 ? (
                    <div className="flex justify-between text-sm pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">Materials Charge</span>
                      <span className="font-medium">{currency} {selectedBooking.materialsCost.toLocaleString()}</span>
                    </div>
                  ) : null}

                  {selectedBooking.materialReservations?.length > 0 && <div className="space-y-1.5 pt-2 border-t border-border/40"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Material operations</p>{selectedBooking.materialReservations.map((reservation: any) => { const shortage = Math.max(0, Number(reservation.requiredQuantity) - Number(reservation.inventoryItem?.currentStock || 0)); return <div key={reservation.id} className="flex items-center justify-between text-xs"><span>{reservation.inventoryItem?.name} · {reservation.requiredQuantity} {reservation.inventoryItem?.unit}</span><Badge variant={shortage ? 'destructive' : 'outline'} className="text-[10px]">{shortage ? `Short ${shortage}` : reservation.status}</Badge></div> })}</div>}

                  {selectedBooking.discount > 0 && (
                    <div className="flex justify-between text-sm pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-500">- {currency} {selectedBooking.discount.toLocaleString()}</span>
                    </div>
                  )}

                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Authoritative Final Total</span>
                    <span className="font-bold text-emerald-600 text-lg">{currency} {selectedBooking.netAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assigned Employees */}
              <div className="py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  <Users className="h-3.5 w-3.5 inline mr-1.5" />Assigned Team ({selectedBooking.assignments?.length || 0})
                </p>
                {selectedBooking.assignments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBooking.assignments.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <span className="text-xs font-semibold text-emerald-700">{a.employee?.user?.name?.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.employee?.user?.name}</p>
                          <p className="text-xs text-muted-foreground">{a.status}</p>
                        </div>
                        {a.customerRating ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs">
                            {a.customerRating.toFixed(1)} ★
                          </Badge>
                        ) : null}
                        {a.actualHours && (
                          <Badge variant="outline" className="text-xs">{a.actualHours }h</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3 text-center">No cleaners assigned yet</p>
                )}
              </div>

              <Separator />

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Truck className="mr-1.5 inline h-3.5 w-3.5"/>Assigned Driver</p>
                <p className={`mt-2 text-sm font-medium ${selectedBooking.driver ? '' : 'text-amber-600'}`}>{selectedBooking.driver?.user?.name || 'No driver assigned'}</p>
              </div>

              <Separator />

              {/* Status History Audit Trail (Prompt 12) */}
              <div className="py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Status History Audit Trail
                </p>
                {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 ? (
                  <div className="space-y-2 border-l-2 border-emerald-500/30 ml-2 pl-3">
                    {selectedBooking.statusHistory.map((h: any) => (
                      <div key={h.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {h.previousStatus === h.newStatus && h.reason ? h.reason : <>{h.previousStatus === 'none' ? 'Created' : h.previousStatus.replace(/_/g, ' ')} → {h.newStatus.replace(/_/g, ' ')}</>}
                          </span>
                          <span className="text-[10px] text-muted-foreground">({h.changedBy || 'system'})</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {format(parseISO(h.createdAt), 'dd MMM yyyy, hh:mm a')} {h.reason && h.previousStatus !== h.newStatus ? `• ${h.reason}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Initial creation record</p>
                )}
              </div>

              {/* Status Action Buttons */}
              {!isTerminalBookingStatus(selectedBooking.status) && (
                <>
                  <Separator />
                  <DialogFooter className="gap-2 pt-2 [&_button]:min-h-11 [&_button]:w-full sm:flex-row sm:justify-start sm:[&_button]:w-auto">
                    {currentRole === 'customer' && customerCanEditBooking(selectedBooking) && (
                      <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => openCustomerBookingEditor(selectedBooking)}><Edit2 className="mr-2 h-4 w-4" />Edit Booking</Button>
                    )}
                    {selectedBooking.status === 'pending_assignment' && (currentRole === 'admin' || currentRole === 'customer') && (
                      <>
                        <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { updateMut.mutate({ id: selectedBooking.id, status: 'cancelled', cancellationReason: `Cancelled by ${currentRole}` }); setDetailOpen(false) }}>Cancel Booking</Button>
                      </>
                    )}
                    {currentRole === 'admin' && selectedBooking.status === 'assigned' && (
                      <Button disabled={!selectedBooking.driverId} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { handleStatusChange(selectedBooking.id, 'scheduled'); setDetailOpen(false) }}>{selectedBooking.driverId ? 'Confirm Booking' : 'Assign Driver First'}</Button>
                    )}
                    {currentRole === 'driver' && (selectedBooking.status === 'scheduled' || selectedBooking.status === 'confirmed') && (
                      <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { handleStatusChange(selectedBooking.id, 'on_the_way'); setDetailOpen(false) }}>Mark On the Way</Button>
                    )}
                    {(currentRole === 'admin' || currentRole === 'cleaner') && selectedBooking.status === 'on_the_way' && (
                      <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { handleStatusChange(selectedBooking.id, 'in_progress'); setDetailOpen(false) }}>Start Service</Button>
                    )}
                    {currentRole === 'cleaner' && selectedBooking.status === 'in_progress' && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
                        onClick={() => {
                          setDetailOpen(false)
                          setCleanerCompleteBookingConfirm(selectedBooking)
                        }}
                      >
                        Complete Booking
                      </Button>
                    )}
                  </DialogFooter>
                  {currentRole === 'customer' && !customerCanEditBooking(selectedBooking) && <p className="pt-2 text-xs text-muted-foreground">Booking details can be edited until 6 hours before the scheduled date and time.</p>}
                </>
              )}
              {selectedBooking.status === 'completed' && (currentRole === 'customer' || (currentRole === 'admin' && selectedBooking.rating)) && (
                <DialogFooter className="pt-2"><Button variant="outline" onClick={() => { setRatingBooking(selectedBooking); setDetailOpen(false) }}><Star className="h-4 w-4 mr-2" />{selectedBooking.rating ? 'View Rating' : 'Rate Team'}</Button></DialogFooter>
              )}
              {currentRole === 'cleaner' && <DialogFooter className="pt-2"><Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { setIssueBooking(selectedBooking); setDetailOpen(false) }}><MessageSquareWarning className="h-4 w-4 mr-2" />Report Customer Issue</Button></DialogFooter>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCustomerBooking)} onOpenChange={(value) => { if (!value) setEditingCustomerBooking(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Booking — {editingCustomerBooking?.bookingNo}</DialogTitle>
            <p className="text-xs text-muted-foreground">Changes are available until 6 hours before the scheduled date and time.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5 sm:col-span-1"><Label htmlFor="customer-edit-date">Date</Label><Input id="customer-edit-date" type="date" min={format(new Date(), 'yyyy-MM-dd')} value={customerEditForm.scheduledDate} onChange={event => setCustomerEditForm(current => ({ ...current, scheduledDate: event.target.value }))} /></div>
              <div className="grid gap-1.5"><Label htmlFor="customer-edit-start">From</Label><Input id="customer-edit-start" type="time" min={firstBookingTime} max={lastWorkingTime} value={customerEditForm.startTime} onChange={event => setCustomerEditForm(current => ({ ...current, startTime: event.target.value }))} /></div>
              <div className="grid gap-1.5"><Label htmlFor="customer-edit-end">To</Label><Input id="customer-edit-end" type="time" min={firstBookingTime} max={lastWorkingTime} value={customerEditForm.endTime} onChange={event => setCustomerEditForm(current => ({ ...current, endTime: event.target.value }))} /></div>
            </div>
            {!customerEditTimeAllowed && customerEditForm.scheduledDate && <p role="alert" className="text-xs text-destructive">Choose a date and start time at least 6 hours from now.</p>}
            {customerEditDuration < MIN_BOOKING_DURATION_HOURS && <p role="alert" className="text-xs text-destructive">Bookings require at least {MIN_BOOKING_DURATION_HOURS} hours.</p>}

            <div className="space-y-2">
              <Label>Services</Label>
              <div className="space-y-2">
                {services.filter((service: any) => service.status !== 'inactive').map((service: any) => {
                  const selected = customerEditForm.serviceIds.includes(service.id)
                  return <div key={service.id} className={`rounded-lg border p-3 ${selected ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" checked={selected} onChange={() => setCustomerEditForm(current => ({ ...current, serviceIds: selected ? current.serviceIds.filter(id => id !== service.id) : [...current.serviceIds, service.id] }))} className="h-4 w-4" /><span className="flex-1 text-sm font-medium">{service.name}</span></label>
                    {selected && <div className="grid grid-cols-2 gap-2 pt-2"><Button type="button" size="sm" variant={!customerEditForm.serviceOptions[service.id] ? 'default' : 'outline'} onClick={() => setCustomerEditForm(current => ({ ...current, serviceOptions: { ...current.serviceOptions, [service.id]: false } }))}>Without materials</Button><Button type="button" size="sm" variant={customerEditForm.serviceOptions[service.id] ? 'default' : 'outline'} onClick={() => setCustomerEditForm(current => ({ ...current, serviceOptions: { ...current.serviceOptions, [service.id]: true } }))}>With materials</Button></div>}
                  </div>
                })}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Cleaner count</Label>
              <div className="relative max-w-44">
                <Input readOnly value={customerEditForm.employeeCount} className="h-11 px-12 text-center font-semibold" aria-label="Cleaner count" />
                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 left-0 h-11 w-11" disabled={customerEditForm.employeeCount <= 1} onClick={() => setCustomerEditForm(current => ({ ...current, employeeCount: Math.max(1, current.employeeCount - 1) }))}><Minus className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-11 w-11" onClick={() => setCustomerEditForm(current => ({ ...current, employeeCount: current.employeeCount + 1 }))}><Plus className="h-4 w-4" /></Button>
              </div>
              {editingCustomerBooking?.assignments?.length > 0 && customerEditForm.employeeCount !== editingCustomerBooking.employeeCount && <p className="text-xs text-amber-700">Changing the cleaner count returns this booking to Pending Assignment so the team can be reassigned.</p>}
            </div>

            <div className="grid gap-1.5"><Label>Service address</Label><Select value={customerEditForm.addressIndex} onValueChange={addressIndex => setCustomerEditForm(current => ({ ...current, addressIndex }))}><SelectTrigger className="min-h-11"><SelectValue placeholder="Select a saved address" /></SelectTrigger><SelectContent>{customerEditAddressOptions.map((address: any, index: number) => <SelectItem key={index} value={String(index)}>{address.label || `Address ${index + 1}`} — {[address.area, address.city, address.address].filter(Boolean).join(', ')}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Manage saved addresses in Profile.</p></div>
            <div className="grid gap-1.5"><Label htmlFor="customer-edit-notes">Booking notes</Label><Textarea id="customer-edit-notes" value={customerEditForm.notes} onChange={event => setCustomerEditForm(current => ({ ...current, notes: event.target.value }))} maxLength={1000} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomerBooking(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveCustomerBookingEdit} disabled={!canSaveCustomerEdit || updateMut.isPending}>{updateMut.isPending ? 'Saving...' : 'Save Booking Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Modal Dialog (Prompt 07) */}
      <Dialog open={Boolean(assigningBooking)} onOpenChange={(v) => { if (!v) { setAssigningBooking(null); setSelectedAssignEmpIds([]); setSelectedAssignDriverId('') } }}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-none grid-rows-[auto_1fr_auto] gap-0 rounded-none border-0 p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:gap-4 sm:rounded-lg sm:border sm:p-6">
          <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:border-0 sm:p-0">
            <DialogTitle className="flex items-start gap-2 text-base leading-6 sm:text-lg">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Assign Team & Driver — {assigningBooking?.bookingNo}
            </DialogTitle>
          </DialogHeader>

          {assigningBooking && (
            <div className="min-h-0 space-y-5 overflow-y-auto px-4 py-4 sm:space-y-4 sm:p-0 sm:py-2">
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/40 p-3 text-sm sm:text-xs">
                <div className="grid gap-1 min-[380px]:grid-cols-[auto_1fr]">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold min-[380px]:text-right">{assigningBooking.customer?.user?.name}</span>
                </div>
                <div className="grid gap-1 min-[380px]:grid-cols-[auto_1fr]">
                  <span className="text-muted-foreground">Slot & Duration:</span>
                  <span className="font-medium min-[380px]:text-right">{format(parseISO(assigningBooking.scheduledDate), 'dd MMM')} · {assigningBooking.startTime} - {assigningBooking.endTime || 'End'} ({assigningBooking.duration}h)</span>
                </div>
                <div className="grid gap-1 min-[380px]:grid-cols-[auto_1fr]">
                  <span className="text-muted-foreground">Requested Team Size:</span>
                  <span className="font-bold text-emerald-700 min-[380px]:text-right dark:text-emerald-400">{assigningBooking.employeeCount || 1} Cleaner{(assigningBooking.employeeCount || 1) === 1 ? '' : 's'} Requested</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-driver">Assigned driver</Label>
                <Select value={selectedAssignDriverId} onValueChange={setSelectedAssignDriverId}>
                  <SelectTrigger id="booking-driver" className="min-h-11"><SelectValue placeholder="Select an available driver" /></SelectTrigger>
                  <SelectContent>{drivers.filter((driver: any) => ['active', 'AVAILABLE'].includes(driver.status)).map((driver: any) => <SelectItem key={driver.id} value={driver.id}>{driver.user?.name} ({driver.driverCode})</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The server checks tenant, active status, and overlapping bookings before assignment.</p>
              </div>

              <div className="grid gap-2 min-[380px]:grid-cols-[1fr_auto] min-[380px]:items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Cleaners</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-full border-emerald-500 text-xs text-emerald-700 hover:bg-emerald-600 hover:text-white min-[380px]:w-auto"
                  onClick={() => assignMut.mutate({ bookingId: assigningBooking.id, driverId: selectedAssignDriverId, employeeIds: selectedAssignEmpIds, autoAssign: true })}
                  disabled={!selectedAssignDriverId || assignMut.isPending}
                >
                  Auto-assign remaining
                </Button>
              </div>

              <div className="space-y-2 sm:max-h-56 sm:overflow-y-auto sm:pr-1">
                {assignAvailabilityError && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{assignAvailabilityError instanceof Error ? assignAvailabilityError.message : 'Failed to check cleaner availability'}</div>}
                {assignAvailability?.allEmployeesStatus ? (
                  assignAvailability.allEmployeesStatus.map((emp: any) => {
                    const isSelected = selectedAssignEmpIds.includes(emp.id)
                    const atCleanerLimit = !isSelected && selectedAssignEmpIds.length >= (assigningBooking.employeeCount || 1)
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          if ((!emp.isAvailable && !isSelected) || atCleanerLimit) return
                          const next = isSelected
                            ? selectedAssignEmpIds.filter(id => id !== emp.id)
                            : [...selectedAssignEmpIds, emp.id]
                          setSelectedAssignEmpIds(next)
                        }}
                        className={`grid min-h-16 grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-3 text-xs transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 font-medium'
                            : !emp.isAvailable || atCleanerLimit
                              ? 'border-border/40 opacity-60 bg-muted/20 cursor-not-allowed'
                              : 'border-border/60 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={(!emp.isAvailable && !isSelected) || atCleanerLimit}
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-5 w-5 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="truncate">
                            <p className="font-semibold truncate">{emp.name} ({emp.employeeCode})</p>
                            <p className="text-[11px] text-muted-foreground">{emp.detailText}</p>
                          </div>
                        </div>
                        <Badge variant={emp.isAvailable ? "outline" : "destructive"} className={`max-w-24 shrink-0 whitespace-normal text-center text-[10px] ${emp.isAvailable ? "border-emerald-300 text-emerald-700 bg-emerald-50/50" : ""}`}>
                          {emp.isAvailable ? '✓ Available' : emp.reason}
                        </Badge>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4">Loading availability...</div>
                )}
              </div>

              {selectedAssignEmpIds.length > 0 && (
                <div className="grid gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 min-[380px]:grid-cols-[auto_1fr]">
                  <span>{selectedAssignEmpIds.length} Staff Selected</span>
                  <span className="min-[380px]:text-right">Recalculated Labour: {selectedAssignEmpIds.length} × Services Rate × {assigningBooking.duration}h</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Select any cleaners you want, then auto-assign the remaining {Math.max(0, (assigningBooking.employeeCount || 1) - selectedAssignEmpIds.length)} slot(s).</p>
            </div>
          )}

          <DialogFooter className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&_button]:min-h-11 [&_button]:w-full sm:border-0 sm:p-0 sm:[&_button]:w-auto">
            <Button variant="outline" onClick={() => { setAssigningBooking(null); setSelectedAssignDriverId('') }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => assignMut.mutate({ bookingId: assigningBooking.id, driverId: selectedAssignDriverId, employeeIds: selectedAssignEmpIds })}
              disabled={!selectedAssignDriverId || selectedAssignEmpIds.length !== (assigningBooking?.employeeCount || 1) || assignMut.isPending}
            >
              {assignMut.isPending ? 'Assigning...' : `Confirm Assignment (${selectedAssignEmpIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Team Modal Dialog */}
      <Dialog open={Boolean(ratingBooking)} onOpenChange={(v) => { if (!v) { setRatingBooking(null); setEmpRatings({}); setOverallRating(5); setOverallComment(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Rate Service & Cleaners — {ratingBooking?.bookingNo}
            </DialogTitle>
          </DialogHeader>

          {ratingBooking && (() => {
            const isAlreadyRated = Boolean(ratingBooking.rating)
            const displayedOverallRating = isAlreadyRated ? ratingBooking.rating.overallRating : overallRating

            return (
              <div className="space-y-4 py-2">
                {isAlreadyRated ? (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Rating Submitted (Read-Only)
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Rate overall service and each assigned cleaner on a scale from 1 to 5 stars.
                  </p>
                )}

                {/* Overall Service Rating */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/50 to-emerald-50/30 dark:from-amber-950/20 dark:to-emerald-950/20 border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      Overall Service Rating
                    </span>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs">
                      {displayedOverallRating} ★
                    </Badge>
                  </div>

                  {!isAlreadyRated && (
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5].map(val => (
                        <Button
                          key={val}
                          type="button"
                          size="sm"
                          variant={overallRating === val ? "default" : "outline"}
                          className={`h-7 px-2 text-xs font-semibold ${overallRating === val ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                          onClick={() => setOverallRating(val)}
                        >
                          {val} ★
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Cleaner Ratings */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">Assigned Cleaners</span>
                  {ratingBooking.assignments?.map((a: any) => {
                    const empId = a.employeeId
                    const currentRating = isAlreadyRated ? (a.customerRating ?? 5) : (empRatings[empId] ?? 5)
                    return (
                      <div key={a.id} className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm">{a.employee?.user?.name || a.employee?.employeeCode}</span>
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs">
                            {currentRating} ★
                          </Badge>
                        </div>

                        {!isAlreadyRated && (
                          <div className="flex flex-wrap gap-1">
                            {[1, 2, 3, 4, 5].map(val => (
                              <Button
                                key={val}
                                type="button"
                                size="sm"
                                variant={currentRating === val ? "default" : "outline"}
                                className={`h-7 px-2 text-xs font-semibold ${currentRating === val ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                                onClick={() => setEmpRatings({ ...empRatings, [empId]: val })}
                              >
                                {val} ★
                              </Button>
                            ))}
                          </div>
                        )}
                        {a.ratingNotes && (
                          <p className="text-xs text-muted-foreground italic pt-1 border-t">"{a.ratingNotes}"</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Optional Written Comment */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Customer Comments & Feedback (Optional)</Label>
                  {isAlreadyRated ? (
                    <div className="p-2.5 rounded-md bg-muted text-xs text-muted-foreground italic border">
                      {ratingBooking.rating.comment || 'No additional comments provided.'}
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Share details about your cleaning experience..."
                      value={overallComment}
                      onChange={e => setOverallComment(e.target.value)}
                      className="text-xs min-h-[60px]"
                    />
                  )}
                  {isAlreadyRated && <p className="text-[11px] text-muted-foreground">Submitted {format(new Date(ratingBooking.rating.submittedAt), 'MMM dd, yyyy HH:mm')}</p>}
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingBooking(null)}>Close</Button>
            {ratingBooking && !ratingBooking.rating && currentRole === 'customer' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
                onClick={() => {
                  const ratingsList = (ratingBooking?.assignments || []).map((a: any) => ({
                    assignmentId: a.id,
                    employeeId: a.employeeId,
                    rating: empRatings[a.employeeId] ?? 5,
                  }))
                  rateMut.mutate({
                    bookingId: ratingBooking.id,
                    overallRating,
                    overallComment: overallComment.trim(),
                    ratings: ratingsList,
                  })
                }}
                disabled={rateMut.isPending}
              >
                {rateMut.isPending ? 'Submitting...' : 'Submit Rating'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Dialog */}
      <Dialog open={Boolean(paymentBooking)} onOpenChange={(open) => { if (!open) setPaymentBooking(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Select Payment Method — {paymentBooking?.bookingNo}
            </DialogTitle>
          </DialogHeader>

          {paymentBooking && (() => {
            const financials = calculateBookingFinancials(paymentBooking)
            return (
              <div className="space-y-4 py-2">
                {/* Financial Summary Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Financial Summary</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Booking Amount</span>
                      <span className="font-medium text-foreground">{currency} {financials.bookingAmount.toLocaleString()}</span>
                    </div>
                    {financials.discount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Applicable Discount</span>
                        <span className="font-medium">-{currency} {financials.discount.toLocaleString()}</span>
                      </div>
                    )}
                    {financials.taxAmount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span className="font-medium text-foreground">{currency} {financials.taxAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Amount Already Paid</span>
                      <span className="font-medium text-foreground">{currency} {financials.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-emerald-800 dark:text-emerald-200 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                      <span>Remaining Payable</span>
                      <span className="text-base text-emerald-600 dark:text-emerald-400">{currency} {financials.remainingPayableAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Selection Mode choices */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Choose Payment Option</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className={`h-20 flex-col gap-1.5 rounded-xl border-2 ${paymentMethod === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : 'hover:border-emerald-300'}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote className="h-6 w-6" />
                      <span className="font-bold text-xs">Pay Cash</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === 'bank_transfer' ? 'default' : 'outline'}
                      className={`h-20 flex-col gap-1.5 rounded-xl border-2 ${paymentMethod === 'bank_transfer' ? 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600' : 'hover:border-teal-300'}`}
                      onClick={() => { setPaymentMethod('bank_transfer'); setPaymentFields(prev => ({ ...prev, transferAmount: String(financials.remainingPayableAmount) })); }}
                    >
                      <Building2 className="h-6 w-6" />
                      <span className="font-bold text-xs">Bank Transfer</span>
                    </Button>
                  </div>
                </div>

                {/* Pay Cash Info */}
                {paymentMethod === 'cash' && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-amber-600" />
                      Cash Payment Selection
                    </p>
                    <p>Cash will be collected by cleaner/driver upon completion or paid directly at the service counter.</p>
                  </div>
                )}

                {/* Bank Transfer Inputs & Info */}
                {paymentMethod === 'bank_transfer' && (
                  <div className="space-y-3 pt-1">
                    {(() => {
                      const activeAccounts = companyAccountsData?.accounts || []
                      const selectedAcc = activeAccounts.find((a: any) => a.id === selectedBankAccountId) || activeAccounts[0]

                      if (!selectedAcc) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">No active company bank account is configured. Please contact support before making a transfer.</div>

                      return (
                        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 text-xs space-y-2">
                          <div className="flex justify-between items-center pb-1.5 border-b border-emerald-200/50 dark:border-emerald-800/40">
                            <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                              <Building2 className="h-4 w-4 text-emerald-600" />
                              Company Bank Details
                            </span>
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>

                          {activeAccounts.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {activeAccounts.map((acc: any) => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => setSelectedBankAccountId(acc.id)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors border ${selectedAcc.id === acc.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background hover:bg-muted text-muted-foreground border-border'}`}
                                >
                                  {acc.bankName} ({acc.currency || currency})
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Bank Name:</span>
                              <span className="font-semibold text-foreground">{selectedAcc.bankName}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Account Title:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-foreground">{selectedAcc.accountTitle}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/50"
                                  title="Copy Account Title"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedAcc.accountTitle)
                                    toast.success('Copied Account Title to clipboard!')
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Account Number:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-foreground">{selectedAcc.accountNumber}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/50"
                                  title="Copy Account Number"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedAcc.accountNumber)
                                    toast.success('Copied Account Number to clipboard!')
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {selectedAcc.iban && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">IBAN:</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-foreground text-[11px]">{selectedAcc.iban}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100/50"
                                    title="Copy IBAN"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedAcc.iban)
                                      toast.success('Copied IBAN to clipboard!')
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {(selectedAcc.branchName || selectedAcc.branch) && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Branch:</span>
                                <span className="font-medium text-foreground">{selectedAcc.branchName || selectedAcc.branch}</span>
                              </div>
                            )}
                            {selectedAcc.branchCode && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Branch Code:</span>
                                <span className="font-medium text-foreground">{selectedAcc.branchCode}</span>
                              </div>
                            )}
                          </div>

                          {selectedAcc.instructions && (
                            <div className="pt-1.5 border-t border-emerald-200/40 dark:border-emerald-800/30">
                              <p className="text-[11px] text-muted-foreground leading-snug"><strong>Instructions:</strong> {selectedAcc.instructions}</p>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <div className="space-y-2">
                      <div>
                        <span className="text-xs">Transaction / Reference # *</span>
                        <input
                          className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-xs"
                          placeholder="e.g. TRX98765432"
                          value={paymentFields.referenceNo}
                          onChange={e => setPaymentFields({ ...paymentFields, referenceNo: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="text-xs">Customer Bank Name *</span>
                        <input
                          className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-xs"
                          placeholder="e.g. Emirates NBD"
                          value={paymentFields.customerBankName}
                          onChange={e => setPaymentFields({ ...paymentFields, customerBankName: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="text-xs">Account Holder Name *</span>
                        <input
                          className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-xs"
                          placeholder="Name on bank account"
                          value={paymentFields.accountHolderName}
                          onChange={e => setPaymentFields({ ...paymentFields, accountHolderName: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs">Transfer Date *</span>
                          <input
                            type="date"
                            className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-xs"
                            value={paymentFields.transferDate}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            onChange={e => setPaymentFields({ ...paymentFields, transferDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <span className="text-xs">Transfer Amount ({currency}) *</span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="text-xs"
                            value={paymentFields.transferAmount}
                            onChange={e => setPaymentFields({ ...paymentFields, transferAmount: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs">Optional Remarks</span>
                        <textarea
                          className="w-full min-h-16 px-3 py-2 rounded-md border border-input bg-transparent text-xs"
                          placeholder="Any details that will help Admin verify the transfer"
                          maxLength={500}
                          value={paymentFields.remarks}
                          onChange={e => setPaymentFields({ ...paymentFields, remarks: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="text-xs">Payment Proof (Screenshot/PDF) *</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleProofUpload}
                            disabled={isUploadingProof}
                            className="text-xs"
                          />
                          {isUploadingProof && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
                        </div>
                        {paymentFields.proofUrl && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium truncate">
                            ✓ Proof attached
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, WEBP, or PDF. Maximum 5 MB.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setPaymentBooking(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={selectPaymentMut.isPending || submitBankTransferMut.isPending || isUploadingProof || (paymentMethod === 'bank_transfer' && !(companyAccountsData?.accounts?.length))}
              onClick={() => {
                if (!paymentBooking) return
                if (paymentMethod === 'bank_transfer') {
                  const activeAccounts = companyAccountsData?.accounts || []
                  const companyBankAccountId = activeAccounts.find((account: any) => account.id === selectedBankAccountId)?.id || activeAccounts[0]?.id
                  const amount = Number(paymentFields.transferAmount)
                  if (!companyBankAccountId || !paymentFields.referenceNo.trim() || !paymentFields.customerBankName.trim() || !paymentFields.accountHolderName.trim() || !paymentFields.transferDate || !paymentFields.proofUrl || !(amount > 0)) {
                    toast.error('Please fill in all bank transfer fields including payment proof')
                    return
                  }
                  const remaining = calculateBookingFinancials(paymentBooking).remainingPayableAmount
                  if (amount > remaining + 0.001) {
                    toast.error(`Transfer amount cannot exceed ${currency} ${remaining}`)
                    return
                  }
                  submitBankTransferMut.mutate({
                    bookingId: paymentBooking.id,
                    companyBankAccountId,
                    referenceNo: paymentFields.referenceNo.trim(),
                    customerBankName: paymentFields.customerBankName.trim(),
                    accountHolderName: paymentFields.accountHolderName.trim(),
                    transferDate: paymentFields.transferDate,
                    transferAmount: amount,
                    proofUrl: paymentFields.proofUrl,
                    remarks: paymentFields.remarks.trim() || undefined,
                  })
                  return
                }
                selectPaymentMut.mutate({
                  bookingId: paymentBooking.id,
                  method: 'cash',
                })
              }}
            >
              {selectPaymentMut.isPending || submitBankTransferMut.isPending ? 'Submitting...' : paymentMethod === 'cash' ? 'Confirm Pay Cash' : 'Submit Bank Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleaner Cash Collection Confirmation Dialog */}
      <Dialog open={Boolean(cleanerCashBooking)} onOpenChange={(open) => { if (!open) setCleanerCashBooking(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Confirm Cash Collection
            </DialogTitle>
          </DialogHeader>

          {cleanerCashBooking && (() => {
            const financials = calculateBookingFinancials(cleanerCashBooking)
            const assignedCleanerName = currentUser?.name || 'Assigned Cleaner'
            return (
              <div className="space-y-4 py-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  Please verify the exact collectible cash amount with the customer before recording receipt.
                </p>

                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Booking Reference</span>
                    <span className="font-mono font-bold text-foreground">{cleanerCashBooking.bookingNo}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-semibold text-foreground">{cleanerCashBooking.customer?.user?.name || 'Customer'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Cleaner Receiving Cash</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{assignedCleanerName}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-semibold text-foreground">{currency}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200">Amount Collected</span>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      {currency} {financials.remainingPayableAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-900 dark:text-amber-300">
                  ⚠️ <strong>Important:</strong> Recording receipt will instantly update the booking payment status to <strong>Paid</strong>. Cash collected will be submitted for admin cash reconciliation.
                </div>
              </div>
            )
          })()}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCleanerCashBooking(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={cleanerReceiveCashMut.isPending}
              onClick={() => {
                if (!cleanerCashBooking) return
                cleanerReceiveCashMut.mutate({
                  bookingId: cleanerCashBooking.id,
                })
              }}
            >
              {cleanerReceiveCashMut.isPending ? 'Recording Cash Receipt...' : 'Confirm Cash Received'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Bank Transfer Review Dialog */}
      <Dialog open={Boolean(reviewingBankTransferBooking)} onOpenChange={(open) => { if (!open) { setReviewingBankTransferBooking(null); setDecisionRemarks(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Building2 className="h-5 w-5 text-purple-600" />
              Review Submitted Bank Transfer
            </DialogTitle>
          </DialogHeader>

          {reviewingBankTransferBooking && (() => {
            const financials = calculateBookingFinancials(reviewingBankTransferBooking)
            const payment = reviewingBankTransferBooking.invoices?.[0]?.payments?.find((p: any) => p.method === 'bank_transfer' && p.status === 'under_verification')
            return (
              <div className="space-y-4 py-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  Verify the customer's transfer proof and reference number against your bank statement before approving or rejecting.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Booking Ref</span>
                    <span className="font-mono font-bold text-foreground">{reviewingBankTransferBooking.bookingNo}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-semibold text-foreground">{reviewingBankTransferBooking.customer?.user?.name || 'Customer'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Reference / Transaction #</span>
                    <span className="font-mono font-bold text-foreground">{payment?.referenceNo || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Customer Bank</span>
                    <span className="font-semibold text-foreground">{payment?.customerBankName || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Account Holder</span>
                    <span className="font-semibold text-foreground">{payment?.accountHolderName || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Transfer Date</span>
                    <span className="font-semibold text-foreground">{payment?.transferDate ? format(new Date(payment.transferDate), 'PP') : 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Transfer Amount</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {currency} {(payment?.amount || financials.remainingPayableAmount).toLocaleString()}
                    </span>
                  </div>

                  {payment?.notes && (
                    <div className="pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground block text-[11px]">Submission Details & Notes:</span>
                      <p className="font-mono text-xs text-foreground bg-muted/40 p-2 rounded mt-1">{payment.notes}</p>
                    </div>
                  )}

                  {payment?.proofUrl && (
                    <div className="pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground block text-[11px] mb-1">Payment Proof Attachment:</span>
                      {payment.proofUrl.endsWith('.pdf') ? (
                        <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-md border border-blue-200">
                          <FileText className="h-4 w-4" /> View Submitted PDF Proof
                        </a>
                      ) : (
                        <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="block group">
                          <img src={payment.proofUrl} alt="Payment Proof" className="max-h-48 rounded-lg border border-border object-contain bg-black/5 p-1 group-hover:opacity-90 transition-opacity" />
                          <span className="text-[11px] text-blue-600 group-hover:underline mt-1 block">Click to open full resolution image</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-foreground">Admin Decision Remarks:</span>
                  <input
                    className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-xs"
                    placeholder="Enter approval memo or reason for rejection (required if rejecting)..."
                    value={decisionRemarks}
                    onChange={e => setDecisionRemarks(e.target.value)}
                  />
                </div>
              </div>
            )
          })()}

          <DialogFooter className="flex justify-between items-center gap-2 pt-2">
            <Button variant="outline" onClick={() => { setReviewingBankTransferBooking(null); setDecisionRemarks(''); }}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                disabled={decideBankTransferMut.isPending}
                onClick={() => {
                  if (!reviewingBankTransferBooking) return
                  const payment = reviewingBankTransferBooking.invoices?.[0]?.payments?.find((item: any) => item.method === 'bank_transfer' && item.status === 'under_verification')
                  if (!payment) {
                    toast.error('No payment record found to reject')
                    return
                  }
                  if (!decisionRemarks.trim()) {
                    toast.error('Please enter decision remarks explaining why the transfer is rejected')
                    return
                  }
                  decideBankTransferMut.mutate({
                    paymentId: payment.id,
                    decision: 'reject',
                    remarks: decisionRemarks.trim(),
                  })
                }}
              >
                {decideBankTransferMut.isPending ? 'Updating...' : 'Reject Transfer'}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={decideBankTransferMut.isPending}
                onClick={() => {
                  if (!reviewingBankTransferBooking) return
                  const payment = reviewingBankTransferBooking.invoices?.[0]?.payments?.find((item: any) => item.method === 'bank_transfer' && item.status === 'under_verification')
                  if (!payment) {
                    toast.error('No payment record found to approve')
                    return
                  }
                  decideBankTransferMut.mutate({
                    paymentId: payment.id,
                    decision: 'approve',
                    remarks: decisionRemarks.trim() || 'Approved by Admin',
                  })
                }}
              >
                {decideBankTransferMut.isPending ? 'Updating...' : 'Approve & Mark Paid'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleaner Complete Booking Confirmation Modal */}
      <AlertDialog open={Boolean(cleanerCompleteBookingConfirm)} onOpenChange={(v) => { if (!v) setCleanerCompleteBookingConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Complete Booking Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-xs">
              <span>Are you sure you want to mark this booking as <strong>Completed</strong>?</span>

              {cleanerCompleteBookingConfirm && (
                <div className="p-3 rounded-lg bg-muted/60 border text-foreground space-y-1 font-sans">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking Ref:</span>
                    <span className="font-mono font-semibold">{cleanerCompleteBookingConfirm.bookingNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-semibold">{cleanerCompleteBookingConfirm.customer?.user?.name || cleanerCompleteBookingConfirm.customerName || 'Customer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span>{[cleanerCompleteBookingConfirm.area, cleanerCompleteBookingConfirm.city].filter(Boolean).join(', ') || 'Service Address'}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-muted-foreground">Completing Cleaner:</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{currentUser?.name || 'Assigned Cleaner'}</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
                ℹ️ Completing this booking will update status from <strong>In Progress</strong> to <strong>Completed</strong>, notify the customer and assigned cleaners, and enable customer payment selection. Payment will remain pending until collected.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={cleanerCompleteMut.isPending}
              onClick={() => {
                if (cleanerCompleteBookingConfirm) {
                  cleanerCompleteMut.mutate({ bookingId: cleanerCompleteBookingConfirm.id })
                }
              }}
            >
              {cleanerCompleteMut.isPending ? 'Marking Completed...' : 'Confirm Completion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(issueBooking)} onOpenChange={open => { if (!open) { setIssueBooking(null); setIssueDescription(''); setIssuePriority('medium') } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Customer Issue</DialogTitle>
            <AlertDialogDescription>Booking {issueBooking?.bookingNo} · {issueBooking?.customer?.user?.name || 'Customer'}</AlertDialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2"><Label>Priority</Label><Select value={issuePriority} onValueChange={(value: any) => setIssuePriority(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['low', 'medium', 'high', 'critical'].map(priority => <SelectItem key={priority} value={priority}>{priority.replace(/^./, letter => letter.toUpperCase())}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Issue details</Label><Textarea value={issueDescription} onChange={event => setIssueDescription(event.target.value)} maxLength={2000} rows={5} placeholder="Describe what happened with the customer..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIssueBooking(null)}>Cancel</Button><Button className="bg-rose-600 hover:bg-rose-700" disabled={issueDescription.trim().length < 5 || reportCustomerIssueMut.isPending} onClick={() => issueBooking && reportCustomerIssueMut.mutate({ bookingId: issueBooking.id, description: issueDescription.trim(), priority: issuePriority })}>{reportCustomerIssueMut.isPending ? 'Submitting...' : 'Submit Issue'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


