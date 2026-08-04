'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Building2, Globe, Clock, Receipt, Hash, Monitor, Paintbrush,
  Sun, Moon, Database, Trash2, ShieldAlert, Save, Server,
  Layers , HardDrive, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const colorPresets = [
  { name: 'Emerald', value: 'emerald', className: 'bg-emerald-500' },
  { name: 'Teal', value: 'teal', className: 'bg-teal-500' },
  { name: 'Amber', value: 'amber', className: 'bg-amber-500' },
]

export function Settings() {
  const [activeTab, setActiveTab] = useState('company')

  // Company editable state
  const [companyName, setCompanyName] = useState('Khobra Cleaning Service')
  const [companySlug, setCompanySlug] = useState('khobra-cleaning')
  const [companyCurrency, setCompanyCurrency] = useState('AED')
  const [companyTimezone, setCompanyTimezone] = useState('Asia/Dubai')
  const [companyLocale, setCompanyLocale] = useState('en-AE')
  const [companyTaxRate, setCompanyTaxRate] = useState('0')
  const [companyPhone, setCompanyPhone] = useState('+971-4-1234567')
  const [companyAddress, setCompanyAddress] = useState('Block 9, Clifton, Dubai')
  const [firstBookingTime, setFirstBookingTime] = useState('08:00')
  const [lastWorkingTime, setLastWorkingTime] = useState('20:00')

  const [compactMode, setCompactMode] = useState(false)

  // Danger zone
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [cacheDialogOpen, setCacheDialogOpen] = useState(false)

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => fetch('/api/khobra-cleaning/settings').then(res => res.json()),
    staleTime: 60000,
  })
  const tenant = settingsData?.tenant
  const savedSettings = settingsData?.settings || {}

  useEffect(() => {
    if (!tenant) return
    setCompanyName(tenant.name || '')
    setCompanySlug(tenant.slug || '')
    setCompanyCurrency(tenant.currency || '')
    setCompanyTimezone(tenant.timezone || '')
    setCompanyLocale(tenant.locale || '')
    setCompanyTaxRate(String(tenant.taxRate ?? 0))
    setFirstBookingTime(tenant.firstBookingTime || '08:00')
    setLastWorkingTime(tenant.lastWorkingTime || '20:00')
    setCompanyPhone(savedSettings.phone || '')
    setCompanyAddress(savedSettings.address || '')
  }, [tenant, savedSettings.phone, savedSettings.address])

  // DB stats query
  const { data: dbStats } = useQuery({
    queryKey: ['db-stats'],
    queryFn: async () => {
      try {
        const endpoints = [
          { key: 'services', label: 'Services' },
          { key: 'customers', label: 'Customers' },
          { key: 'employees', label: 'Cleaners' },
          { key: 'bookings', label: 'Bookings' },
          { key: 'invoices', label: 'Invoices' },
          { key: 'payments', label: 'Payments' },
          { key: 'complaints', label: 'Complaints' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'inventory', label: 'Inventory' },
          { key: 'drivers', label: 'Drivers' },
        ]
        const results = await Promise.all(
          endpoints.map(async e => {
            const url = e.key === 'inventory'
              ? '/api/khobra-cleaning/inventory'
              : `/api/khobra-cleaning/${e.key}`
            try {
              const res = await fetch(url)
              const data = await res.json()
              const count = Array.isArray(data) ? data.length : (data?.records?.length || data?.length || 0)
              return { label: e.label, count }
            } catch {
              return { label: e.label, count: 0 }
            }
          })
        )
        return results
      } catch {
        return []
      }
    },
    staleTime: 30000,
  })

  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  const qc = useQueryClient()
  const saveSettingsMut = useMutation({
    mutationFn: (d: any) => fetch('/api/khobra-cleaning/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Company settings saved to database') },
    onError: () => toast.error('Failed to save settings'),
  })

  const handleSaveCompany = () => {
    saveSettingsMut.mutate({
      name: companyName,
      slug: companySlug,
      currency: companyCurrency,
      locale: companyLocale,
      timezone: companyTimezone,
      taxRate: Number(companyTaxRate),
      firstBookingTime,
      lastWorkingTime,
      settings: { phone: companyPhone, address: companyAddress },
    })
  }

  const handleToggleTheme = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light'
    setTheme(newTheme)
    toast.success(checked ? 'Dark mode enabled' : 'Light mode enabled')
  }

  const handleSelectColor = (color: string) => {
    toast.success(`Accent color set to ${color}`)
  }

  const handleCompactToggle = (checked: boolean) => {
    setCompactMode(checked)
    if (typeof window !== 'undefined') {
      localStorage.setItem('khobra_compact_mode', String(checked))
      if (checked) document.documentElement.classList.add('compact-layout')
      else document.documentElement.classList.remove('compact-layout')
    }
    toast.success(`Compact mode ${checked ? 'enabled' : 'disabled'}`)
  }

  const handleClearCache = () => {
    localStorage.clear()
    sessionStorage.clear()
    setCacheDialogOpen(false)
    toast.success('Browser cache and local storage cleared')
    window.location.reload()
  }

  const handleDataReset = () => {
    setResetDialogOpen(false)
    toast.error('Database reset must be executed via administrative seed CLI (npm run db:seed).')
  }

  const companyFields = [
    { label: 'Company Name', value: companyName, setter: setCompanyName, placeholder: 'e.g. Khobra Cleaning Service', icon: Building2 },
    { label: 'Slug / Identifier', value: companySlug, setter: setCompanySlug, placeholder: 'e.g. khobra-cleaning', icon: Hash },
    { label: 'Currency', value: companyCurrency, setter: setCompanyCurrency, placeholder: 'e.g. AED', icon: Receipt },
    { label: 'Timezone', value: companyTimezone, setter: setCompanyTimezone, placeholder: 'e.g. Asia/Dubai', icon: Clock },
    { label: 'Locale', value: companyLocale, setter: setCompanyLocale, placeholder: 'e.g. en-AE', icon: Globe },
    { label: 'Tax Rate (%)', value: companyTaxRate, setter: setCompanyTaxRate, placeholder: 'e.g. 0', icon: Receipt },
    { label: 'Phone', value: companyPhone, setter: setCompanyPhone, placeholder: '+92-21-...', icon: null },
    { label: 'Address', value: companyAddress, setter: setCompanyAddress, placeholder: 'Full address...', icon: null },
  ]

  const systemInfo = [
    { label: 'Framework', value: 'Next.js 16 (App Router)', icon: Layers },
    { label: 'Database', value: 'SQLite / Prisma ORM', icon: Database },
    { label: 'UI Library', value: 'shadcn/ui + Tailwind CSS 4', icon: Paintbrush },
    { label: 'Primary Domain', value: 'Hourly Cleaning & Field Service', icon: Building2 },
    { label: 'Version', value: 'Phase 1 v1.0', icon: Info },
    { label: 'SaaS Ready', value: 'Yes', icon: ShieldAlert },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Platform configuration and company settings</p>
      </motion.div>

      {/* Tabbed Layout */}
      <motion.div {...fadeUp}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="company" className="text-xs sm:text-sm">
              <Building2 className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Company
            </TabsTrigger>
            <TabsTrigger value="booking_hours" className="text-xs sm:text-sm">
              <Clock className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Booking Hours
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs sm:text-sm">
              <Server className="h-4 w-4 mr-1.5 hidden sm:inline" />
              System
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs sm:text-sm">
              <Paintbrush className="h-4 w-4 mr-1.5 hidden sm:inline" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company">
            <motion.div {...fadeUp}>
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                <CardHeader className="pl-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Company Information</CardTitle>
                      <CardDescription>Edit your company details and preferences.</CardDescription>
                    </div>
                    <Badge variant="outline">{tenant?.status || 'active'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-5">
                    {companyFields.map((field, index) => (
                      <div key={field.label}>
                        {index > 0 && <Separator className="mb-4" />}
                        <div className="flex items-start gap-4">
                          {field.icon && (
                            <div className="p-2 rounded-lg bg-muted/50 mt-0.5">
                              <field.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 grid gap-1.5">
                            <Label className="text-sm font-medium">{field.label}</Label>
                            <Input
                              value={field.value}
                              onChange={e => field.setter(e.target.value)}
                              placeholder={field.placeholder}
                              className="max-w-md"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-end pt-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSaveCompany}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          </TabsContent>

          {/* Booking Hours Tab (Prompt 18) */}
          <TabsContent value="booking_hours">
            <motion.div {...fadeUp}>
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-emerald-500" />
                <CardHeader className="pl-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-5 w-5 text-emerald-600" />
                        Booking Settings → Booking Hours
                      </CardTitle>
                      <CardDescription>Configure operational business hours for daily service bookings.</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 font-mono">
                      {firstBookingTime} – {lastWorkingTime}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <strong>Operational Window:</strong> Customer and Admin bookings can only be scheduled starting at or after <strong>{firstBookingTime}</strong> and finishing strictly by or before <strong>{lastWorkingTime}</strong>.
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">First Booking Start Time</Label>
                      <Input
                        type="time"
                        value={firstBookingTime}
                        onChange={e => setFirstBookingTime(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">Earliest allowed start time for any booking.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Last Working / Booking End Time</Label>
                      <Input
                        type="time"
                        value={lastWorkingTime}
                        onChange={e => setLastWorkingTime(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">Latest time assigned cleaners can complete work.</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleSaveCompany}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Booking Hours
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <motion.div {...fadeUp}>
            <div className="space-y-6">
              {/* System Info */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 to-cyan-500" />
                <CardHeader className="pl-6">
                  <CardTitle className="text-base">System Information</CardTitle>
                  <CardDescription>Platform and deployment details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {systemInfo.map((info, index) => (
                      <div key={info.label}>
                        {index > 0 && <Separator className="mb-3" />}
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-muted/50">
                              <info.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">{info.label}</span>
                          </div>
                          {info.label === 'SaaS Ready' || info.label === 'Vers ion' ? (
                            <Badge
                              className={
                                info.label === 'SaaS Ready'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
                              }
                            >
                              {info.value}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">{info.value}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Database Stats */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                <CardHeader className="pl-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                      <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Database Statistics</CardTitle>
                      <CardDescription>Records count per table.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dbStats ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {dbStats.map((stat: any) => (
                        <div
                          key={stat.label}
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/50 border border-border/50"
                        >
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {stat.count}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">{stat.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Maintenance */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
                <CardHeader className="pl-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/30">
                      <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Maintenance</CardTitle>
                      <CardDescription>Cache management and data operations.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">Clear Browser Cache</p>
                        <p className="text-xs text-muted-foreground">Clear local storage and session data</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCacheDialogOpen(true)}>
                        Clear Cache
                      </Button>
                    </div>
                    <Separator />
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-orange-500" />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/30">
                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                      <CardDescription>Irrevers ible and destructive actions.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Reset All Data</p>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70">
                        This will permanently delete all data and re-seed the database. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Reset Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            </motion.div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <motion.div {...fadeUp}>
            <div className="space-y-6">
              {/* Theme Toggle */}
              <Card className="border-0 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 to-cyan-500" />
                <CardHeader className="pl-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Theme</CardTitle>
                      <CardDescription>Toggle between light and dark mode.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      {isDark ? (
                        <Moon className="h-5 w-5 text-violet-500" />
                      ) : (
                        <Sun className="h-5 w-5 text-amber-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {isDark ? 'Dark Mode' : 'Light Mode'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isDark ? 'Currently using dark theme' : 'Currently using light theme'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
                  </div>
                </CardContent>
              </Card>

              {/* Primary Color */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Paintbrush className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Primary Color</CardTitle>
                      <CardDescription>Choose your preferred accent color.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        className="flex items-center gap-3 p-3 rounded-lg border-2 transition-all hover:scale-105"
                        style={{
                          borderColor: 'hsl(var(--border))',
                          backgroundColor: 'transparent',
                        }}
                        onClick={() => handleSelectColor(preset.value)}
                      >
                        <div className={`h-8 w-8 rounded-full ${preset.className} shadow-md`} />
                        <span className="text-sm font-medium">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Compact Mode */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Display Mode</CardTitle>
                      <CardDescription>Adjust density and spacing preferences.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">Compact Mode</p>
                      <p className="text-xs text-muted-foreground">
                        {compactMode
                          ? 'Reduce padding and spacing for denser layouts'
                          : 'Standard spacing for comfortable reading'}
                      </p>
                    </div>
                    <Switch checked={compactMode} onCheckedChange={handleCompactToggle} />
                  </div>
                </CardContent>
              </Card>
            </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Cache Clear Dialog */}
      <AlertDialog open={cacheDialogOpen} onOpenChange={setCacheDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Browser Cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all locally cached data, preferences, and session tokens. You will be
              redirected to reload the application. This does not affect server-side data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearCache}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear Cache
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data Reset Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              Reset All Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a destructive and irrevers ible action. All data will be permanently deleted and
              the database will be re-seeded with demo data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDataReset}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


