'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useAppStore, type ViewId, type RoleId } from '@/store/app-store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Sparkles, Users, UserCheck, CalendarDays, Wallet, Truck, Package, BarChart3, MessageSquareWarning, Clock, Settings, Menu, Sun, Moon, ChevronDown, X, Shield, Bell, CalendarCheck, DollarSign, UsersRound, Banknote, Search, Command, Zap, UserPlus, FileText, Plus, Building2, LogIn, ShieldCheck, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/ui/logo'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/error-boundary'
import { useRealtime } from '@/hooks/use-realtime'

const Dashboard = dynamic(() => import('@/components/khobra-cleaning/dashboard').then(m => ({ default: m.Dashboard })), { loading: () => <PageSkeleton />, ssr: false })
const Services = dynamic(() => import('@/components/khobra-cleaning/services').then(m => ({ default: m.Services })), { loading: () => <PageSkeleton />, ssr: false })
const Customers= dynamic(() => import('@/components/khobra-cleaning/customers').then(m => ({ default: m.Customers})), { loading: () => <PageSkeleton />, ssr: false })
const Employees = dynamic(() => import('@/components/khobra-cleaning/employees').then(m => ({ default: m.Employees })), { loading: () => <PageSkeleton />, ssr: false })
const Bookings = dynamic(() => import('@/components/khobra-cleaning/bookings').then(m => ({ default: m.Bookings })), { loading: () => <PageSkeleton />, ssr: false })
const Finance = dynamic(() => import('@/components/khobra-cleaning/finance').then(m => ({ default: m.Finance })), { loading: () => <PageSkeleton />, ssr: false })
const Dispatch = dynamic(() => import('@/components/khobra-cleaning/dispatch').then(m => ({ default: m.Dispatch })), { loading: () => <PageSkeleton />, ssr: false })
const Inventory = dynamic(() => import('@/components/khobra-cleaning/inventory').then(m => ({ default: m.Inventory })), { loading: () => <PageSkeleton />, ssr: false })
const Reports = dynamic(() => import('@/components/khobra-cleaning/reports').then(m => ({ default: m.Reports })), { loading: () => <PageSkeleton />, ssr: false })
const Complaints = dynamic(() => import('@/components/khobra-cleaning/complaints').then(m => ({ default: m.Complaints })), { loading: () => <PageSkeleton />, ssr: false })
const Attendance = dynamic(() => import('@/components/khobra-cleaning/attendance').then(m => ({ default: m.Attendance })), { loading: () => <PageSkeleton />, ssr: false })
const Payroll = dynamic(() => import('@/components/khobra-cleaning/payroll').then(m => ({ default: m.Payroll })), { loading: () => <PageSkeleton />, ssr: false })
const BranchesView = dynamic(() => import('@/components/khobra-cleaning/branches').then(m => ({ default: m.Branches })), { loading: () => <PageSkeleton />, ssr: false })
const AuthPage = dynamic(() => import('@/components/khobra-cleaning/auth').then(m => ({ default: m.AuthPage })), { loading: () => <PageSkeleton />, ssr: false })
const RBACManagement = dynamic(() => import('@/components/khobra-cleaning/rbac').then(m => ({ default: m.RBACManagement })), { loading: () => <PageSkeleton />, ssr: false })
const CustomerProfile = dynamic(() => import('@/components/khobra-cleaning/profile').then(m => ({ default: m.CustomerProfile })), { loading: () => <PageSkeleton />, ssr: false })
const NotificationManagement = dynamic(() => import('@/components/khobra-cleaning/notifications-management').then(m => ({ default: m.NotificationManagement })), { loading: () => <PageSkeleton />, ssr: false })
const SettingsPage = dynamic(() => import('@/components/khobra-cleaning/settings').then(m => ({ default: m.Settings })), { loading: () => <PageSkeleton />, ssr: false })

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      <Skeleton className="h-[300px] w-full rounded-xl" />
    </div>
  )
}

interface DashboardStats {
  totalBookings: number
  todayBookings: number
  completedBookings: number
  pendingBookings: number
  totalRevenue: number
  activeEmployees: number
  openComplaints: number
}

const navItems: { id: ViewId; label: string; icon: React.ElementType; roles: RoleId[]; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'customer', 'cleaner', 'driver'], description: 'Operations overview and KPIs' },
  { id: 'services', label: 'Services', icon: Sparkles, roles: ['admin'], description: 'Service catalog management' },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin'], description: 'Customer directory' },
  { id: 'employees', label: 'Cleaners', icon: UserCheck, roles: ['admin'], description: 'Cleaner management' },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays, roles: ['admin', 'customer'], description: 'Booking management and scheduling' },
  { id: 'finance', label: 'Finance', icon: Wallet, roles: ['admin'], description: 'Invoices and payments' },
  { id: 'dispatch', label: 'Dispatch', icon: Truck, roles: ['admin'], description: 'Driver and trip management' },
  { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'], description: 'Stock and vendor management' },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin'], description: 'Analytics and insights' },
  { id: 'complaints', label: 'Complaints', icon: MessageSquareWarning, roles: ['admin', 'customer'], description: 'Issue tracking' },
  { id: 'attendance', label: 'Attendance', icon: Clock, roles: ['admin', 'cleaner'], description: 'Time tracking' },
  { id: 'payroll', label: 'Payroll', icon: Banknote, roles: ['admin'], description: 'Salary processing' },
  { id: 'branches', label: 'Branches', icon: Building2, roles: ['admin'], description: 'Location and branch management' },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['admin'], description: 'Broadcast system alerts & notifications' },
  { id: 'rbac', label: 'Access Control', icon: ShieldCheck, roles: ['admin'], description: 'Custom roles & dynamic permissions' },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'], description: 'Platform configuration' },
]

const viewPathMap: Record<ViewId, string> = {
  dashboard: '/',
  services: '/services',
  customers: '/customers',
  employees: '/employees',
  bookings: '/bookings',
  finance: '/finance',
  dispatch: '/dispatch',
  inventory: '/inventory',
  reports: '/reports',
  complaints: '/complaints',
  attendance: '/attendance',
  payroll: '/payroll',
  branches: '/branches',
  rbac: '/rbac',
  settings: '/settings',
  login: '/login',
  signup: '/signup',
  profile: '/profile',
  notifications: '/notifications',
}

const pathToViewMap: Record<string, ViewId> = Object.entries(viewPathMap).reduce(
  (acc, [view, path]) => ({ ...acc, [path]: view as ViewId }),
  {},
)

const roleLabels: Record<RoleId, string> = { admin: 'Admin', customer: 'Customer', cleaner: 'Cleaner', driver: 'Driver' }

const roleColors : Record<RoleId, string> = {
  admin: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  customer: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  cleaner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  driver: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
}

const viewTitles: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  services: 'Service Catalog',
  customers: 'Customers',
  employees: 'Cleaners',
  bookings: 'Bookings',
  finance: 'Finance',
  dispatch: 'Dispatch',
  inventory: 'Inventory',
  reports: 'Reports',
  complaints: 'Complaints',
  attendance: 'Attendance',
  payroll: 'Payroll',
  branches: 'Branches',
  rbac: 'Access Control (RBAC)',
  settings: 'Settings',
  login: 'Login',
  signup: 'Customer Signup',
  profile: 'My Customer Profile',
  notifications: 'Notifications Management',
}

function LiveClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null
  return <span className="text-xs font-mono text-muted-foreground tabular-nums">{time}</span>
}

const quickActions = [
  { id: 'qa_new_booking' as const, label: 'New Booking', description: 'Create a booking', icon: CalendarDays, view: 'bookings' as ViewId },
  { id: 'qa_new_customer' as const, label: 'New Customer', description: 'Add a customer', icon: UserPlus, view: 'customers' as ViewId },
  { id: 'qa_new_service' as const, label: 'New Service', description: 'Add a service', icon: Plus, view: 'services' as ViewId },
  { id: 'qa_new_complaint' as const, label: 'File Complaint', description: 'Report an issue', icon: MessageSquareWarning, view: 'complaints' as ViewId },
  { id: 'qa_clock_in' as const, label: 'Clock In/Out', description: 'Mark attendance', icon: Clock, view: 'attendance' as ViewId },
  { id: 'qa_invoice' as const, label: 'View Invoices', description: 'Financial records', icon: FileText, view: 'finance' as ViewId },
]

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currentRole, setView } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  const allItems = useMemo(() => {
    const roleItems = navItems.filter(item => item.roles.includes(currentRole))
    const actions = quickActions.filter(a => {
      const targetNav = navItems.find(n => n.id === a.view)
      return targetNav?.roles.includes(currentRole)
    })
    return { nav: roleItems, actions }
  }, [currentRole])

  const filteredNav = useMemo(() => {
    if (!query) return allItems.nav
    const q = query.toLowerCase()
    return allItems.nav.filter(item =>
      item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    )
  }, [query, allItems.nav])

  const filteredActions = useMemo(() => {
    if (!query) return allItems.actions
    const q = query.toLowerCase()
    return allItems.actions.filter(a =>
      a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [query, allItems.actions])

  const totalCount = filteredNav.length + filteredActions.length

  const handleSelect = useCallback((id: ViewId) => {
    setView(id)
    setQuery('')
    setActiveIdx(0)
    onOpenChange(false)
  }, [setView, onOpenChange])

  const handleActionSelect = useCallback((action: typeof quickActions[number]) => {
    setView(action.view)
    setQuery('')
    setActiveIdx(0)
    onOpenChange(false)
  }, [setView, onOpenChange])

  // Keyboard shortcut to open + navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, totalCount - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && totalCount > 0) {
        e.preventDefault()
        if (activeIdx < filteredNav.length) {
          handleSelect(filteredNav[activeIdx].id)
        } else {
          const actionIdx = activeIdx - filteredNav.length
          if (filteredActions[actionIdx]) handleActionSelect(filteredActions[actionIdx])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange, totalCount, activeIdx, filteredNav, filteredActions, handleSelect, handleActionSelect])

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setQuery(''); setActiveIdx(0) } }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search pages, actions..."
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            className="flex-1 h-12 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {totalCount === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            <div className="space-y-0.5">
              {filteredNav.length > 0 && (
                <>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigation</p>
                  {filteredNav.map((item, idx) => {
                    const Icon = item.icon
                    const isSelected = idx === activeIdx
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors text-left ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary/20' : 'bg-primary/10'}`}>
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        {isSelected && <kbd className="text-[9px] text-muted-foreground">↵</kbd>}
                      </button>
                    )
                  })}
                </>
              )}
              {filteredActions.length > 0 && (
                <>
                  <p className="px-2 py-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
                  {filteredActions.map((action, idx) => {
                    const globalIdx = filteredNav.length + idx
                    const Icon = action.icon
                    const isSelected = globalIdx === activeIdx
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleActionSelect(action)}
                        onMouseEnter={() => setActiveIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors text-left ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-accent/20' : 'bg-accent/10'}`}>
                          <Icon className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{action.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                        </div>
                        {isSelected && <kbd className="text-[9px] text-muted-foreground">↵</kbd>}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2.5 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">ESC</kbd> Close</span>
          <span className="ml-auto">{totalCount} result{totalCount !== 1 ? 's' : ''}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NotificationPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient()
  const { subscribe, onEvent } = useRealtime()
  useEffect(() => { subscribe('booking:updated'); onEvent('booking:updated', () => qc.invalidateQueries({ queryKey: ['notifications'] })) }, [onEvent, qc, subscribe])
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/khobra-cleaning/notifications').then(r => r.json()),
  })

  const markReadMut = useMutation({
    mutationFn: (id: string) => fetch('/api/khobra-cleaning/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMut = useMutation({
    mutationFn: () => fetch('/api/khobra-cleaning/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogTitle className="sr-only">Notifications</DialogTitle>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-700">
                  {unreadCount} new
                </Badge>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => markAllReadMut.mutate()}>
                  Mark all read
                </button>
              </>
            )}
          </div>
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No notifications</div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => { markReadMut.mutate(n.id); onOpenChange(false) }}
                className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                  <div className={`flex-1 min-w-0 ${n.read ? 'ml-5' : ''}`}>
                    <p className={`text-sm ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message || n.desc}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccessDeniedView({ view }: { view: ViewId }) {
  const { setView } = useAppStore()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
      <div className="p-4 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
        <Shield className="h-10 w-10" />
      </div>
      <h2 className="text-xl font-bold tracking-tight">Access Denied</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Your role does not have permission to view the <span className="font-semibold capitalize text-foreground">{view}</span> module. Please contact an administrator to update your role permissions.
      </p>
      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setView('dashboard')}>
        Return to Dashboard
      </Button>
    </div>
  )
}

function ViewRenderer({ view, currentRole, allowedPages }: { view: ViewId; currentRole: RoleId; allowedPages?: string[] }) {
  const isUniversallyAllowed = view === 'dashboard' || view === 'profile' || view === 'login' || view === 'signup'
  if (currentRole !== 'admin' && !isUniversallyAllowed) {
    if (allowedPages && Array.isArray(allowedPages) && !allowedPages.includes(view)) {
      return <AccessDeniedView view={view} />
    }
  }

  const Comp = (() => {
    switch (view) {
      case 'dashboard': return Dashboard
      case 'services': return Services
      case 'customers': return Customers
      case 'employees': return Employees
      case 'bookings': return Bookings
      case 'finance': return Finance
      case 'dispatch': return Dispatch
      case 'inventory': return Inventory
      case 'reports': return Reports
      case 'complaints': return Complaints
      case 'attendance': return Attendance
      case 'payroll': return Payroll
      case 'branches': return BranchesView
      case 'login':
      case 'signup': return AuthPage
      case 'rbac': return RBACManagement
      case 'profile': return CustomerProfile
      case 'notifications': return NotificationManagement
      case 'settings': return SettingsPage
      default: return Dashboard
    }
  })()
  return <ErrorBoundary><Comp /></ErrorBoundary>
}

export default function HomePage() {
  const { currentView, currentRole, currentUser, logout, sidebarOpen, setView, setUser, toggleSidebar, setSidebarOpen } = useAppStore()
  const { theme, setTheme } = useTheme()

  const [sessionChecked, setSessionChecked] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Sync initial view from URL path & listen for browser back/forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const currentPath = window.location.pathname
    const matchedView = pathToViewMap[currentPath]
    if (matchedView && matchedView !== currentView) {
      setView(matchedView)
    }

    const onPopState = () => {
      const path = window.location.pathname
      const v = pathToViewMap[path] || 'dashboard'
      setView(v)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setView])

  // Custom navigate function updating both Zustand state and browser URL path
  const navigateTo = useCallback((view: ViewId) => {
    setView(view)
    if (typeof window !== 'undefined') {
      const targetPath = viewPathMap[view] || '/'
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath)
      }
    }
  }, [setView])

  useEffect(() => {
    fetch('/api/khobra-cleaning/auth/me')
      .then((response) => response.json())
      .then((data) => { if (data.user) setUser(data.user) })
      .catch(() => {
        logout()
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          window.history.replaceState(null, '', '/login')
        }
      })
      .finally(() => setSessionChecked(true))
  }, [logout, setUser])

  useEffect(() => {
    if (!currentUser?.expiresAt) return
    const timeout = setTimeout(() => {
      logout()
      window.history.replaceState(null, '', '/login')
    }, Math.max(0, currentUser.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [currentUser?.expiresAt, logout])

  useEffect(() => {
    fetch('/api/khobra-cleaning/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) {
          setStats({
            totalBookings: data.stats.totalBookings ?? 0,
            todayBookings: data.stats.todayBookings ?? 0,
            completedBookings: data.stats.completedBookings ?? 0,
            pendingBookings: data.stats.pendingBookings ?? 0,
            totalRevenue: data.stats.totalRevenue ?? 0,
            activeEmployees: data.stats.activeEmployees ?? 0,
            openComplaints: data.stats.openComplaints ?? 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  const { data: rbacData } = useQuery({
    queryKey: ['rbac'],
    queryFn: () => fetch('/api/khobra-cleaning/rbac').then(r => r.json()),
  })

  const rolePermissions: Record<string, string[]> = rbacData?.permissions || {}
  const allowedPages = rolePermissions[currentRole] || null

  const filteredNav = useMemo(() => {
    if (currentRole === 'admin') {
      return navItems.filter(item => item.roles.includes('admin'))
    }
    if (allowedPages && Array.isArray(allowedPages)) {
      return navItems.filter(item => allowedPages.includes(item.id))
    }
    return navItems.filter(item => item.roles.includes(currentRole))
  }, [currentRole, allowedPages])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag == "INPUT" || tag == "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key == "Escape") { setCmdOpen(false); setNotifOpen(false); setSidebarOpen(false); return }
      if (e.key == "/" || ((e.metaKey || e.ctrlKey) && e.key == "k")) { e.preventDefault(); setCmdOpen(true); return }
      if (e.key == "d") { navigateTo("dashboard"); return }
      if (e.key == "n") { navigateTo("bookings"); return }
      const num = parseInt(e.key)
      if (num >= 1 && num <= 9) { const nav = filteredNav[num - 1]; if (nav) { navigateTo(nav.id); setSidebarOpen(false) } return }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [navigateTo, setSidebarOpen, filteredNav])

  const miniStats = [
    { icon: CalendarCheck, label: 'Bookings Today', value: stats?.todayBookings ?? '--', color: 'text-emerald-600 dark:text-emerald-400' },
    { icon: DollarSign, label: 'Revenue', value: stats ? `AED ${(stats.totalRevenue / 1000).toFixed(1)}k` : '--', color: 'text-amber-600 dark:text-amber-400' },
    { icon: UsersRound, label: 'Cleaners', value: stats?.activeEmployees ?? '--', color: 'text-cyan-600 dark:text-cyan-400' },
  ]

  if (!sessionChecked) return <div className="min-h-screen bg-background p-8"><PageSkeleton /></div>
  if (!currentUser) return <AuthPage />

  const sidebar = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 flex items-center justify-between shrink-0">
        <Logo size={36} showText={true} />
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 ml-auto" onClick={() => setSidebarOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-emerald-500 via-emerald-300 to-transparent shrink-0" />

      {/* Unified Scrollable Container for Menu, Search & Overview */}
      <div className="flex-1 overflow-y-auto min-h-0 py-3 px-3 space-y-4">
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Main Menu</p>
          <nav className="space-y-1">
            {filteredNav.map(item => {
              const Icon = item.icon
              const isActive = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { navigateTo(item.id); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border-l-2 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 border-l-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-transparent hover:translate-x-1'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.id === 'complaints' && stats && stats.openComplaints > 0 && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Search shortcut */}
        <button
          onClick={() => setCmdOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:bg-muted hover:border-muted-foreground/50 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-auto rounded border bg-muted/50 px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
        </button>

        {/* Overview card */}
        <div className="p-3 rounded-xl bg-card border shadow-sm backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">Overview</p>
          <div className="space-y-2">
            {miniStats.map((s) => {
              const SIcon = s.icon
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <SIcon className={`h-3.5 w-3.5 shrink-0 ${s.color}`} />
                  <span className="text-[11px] text-muted-foreground flex-1 truncate">{s.label}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{s.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer User Info */}
      <div className="p-3 border-t shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{currentUser?.name || 'Administrator'}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{currentRole}</p>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar — static, no portal */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border shadow-xl z-20">
        {sidebar}
      </aside>

      {/* Mobile Sidebar — CSS-only overlay, no Radix portal */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar backdrop-blur-xl border-r border-sidebar-border shadow-xl lg:hidden flex flex-col">
            {sidebar}
          </div>
        </>
      )}

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* Notification Panel */}
      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 flex flex-col min-h-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-6 bg-background/80 backdrop-blur-md">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={toggleSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="lg:hidden flex items-center gap-2">
              <Logo size={28} showText={true} textClassName="font-bold text-xs truncate" subtextClassName="hidden" />
            </div>
            {/* Breadcrumb-style title */}
            <div className="hidden lg:flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">
                {viewTitles[currentView] ?? 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex h-8 gap-1.5 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-colors">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">Quick Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickActions.filter(a => {
                  const targetNav = navItems.find(n => n.id === a.view)
                  return targetNav?.roles.includes(currentRole)
                }).map(action => {
                  const Icon = action.icon
                  return (
                    <DropdownMenuItem key={action.id} onClick={() => setView(action.view)}>
                      <Icon className="h-4 w-4 mr-2 text-primary" />
                      {action.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Command Palette Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-8 gap-2 text-muted-foreground font-normal"
              onClick={() => setCmdOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </Button>

            {/* Live Clock */}
            <div className="hidden md:block mr-0.5">
              <LiveClock />
            </div>

            {/* Notification Bell */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative" onClick={() => setNotifOpen(true)}>
                  <Bell className="h-4 w-4" />
                  {stats && stats.openComplaints > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                      {stats.openComplaints}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{stats?.openComplaints ? `${stats.openComplaints} open complaint(s)` : 'No open complaints'}</TooltipContent>
            </Tooltip>

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Authenticated User Profile Dropdown or Sign In */}
            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-2 border-emerald-300 dark:border-emerald-700">
                    <Avatar className="h-5 w-5 bg-emerald-600 text-white text-[10px] font-bold">
                      <AvatarFallback className="bg-emerald-600 text-white">
                        {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-xs max-w-[120px] truncate">{currentUser.name}</span>
                    <Badge className={roleColors[currentRole]} variant="secondary">
                      {roleLabels[currentRole]}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{currentUser.name}</p>
                      <p className="text-xs text-muted-foreground leading-none">{currentUser.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigateTo('profile')}>
                    <User className="h-4 w-4 mr-2" />
                    <span>My Profile & Addresses</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await fetch('/api/khobra-cleaning/auth/logout', { method: 'POST' }).catch(() => null)
                      logout()
                      window.history.replaceState(null, '', '/login')
                    }}
                    className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/20"
                  >
                    <LogIn className="h-4 w-4 mr-2 rotate-180" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => navigateTo('login')}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                <ViewRenderer view={currentView} currentRole={currentRole} allowedPages={allowedPages} />
              </main>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sticky Footer */}
        <footer className="relative mt-auto">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="bg-card px-4 lg:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={20} showText={false} />
              <p className="text-[11px] text-muted-foreground">
                &copy; {new Date().getFullYear()} Khobra Cleaning Service. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-muted-foreground/70 font-medium">
                Powered by Khobra Cleaning v2.0
              </p>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-primary border-primary/30">Dubai</Badge>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}


