'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  LogIn, UserPlus, Lock, Mail, Phone, MapPin, Building, User, Sparkles, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Logo } from '@/components/ui/logo'
import { Turnstile } from './turnstile'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function AuthPage() {
  const { currentView, setView, setUser } = useAppStore()
  const initialTab = currentView === 'signup' || (typeof window !== 'undefined' && window.location.pathname.includes('/signup')) ? 'signup' : 'login'
  const [tab, setTabState] = useState<'login' | 'signup'>(initialTab)
  const qc = useQueryClient()

  const handleTabChange = (v: 'login' | 'signup') => {
    setTabState(v)
    setView(v)
    if (typeof window !== 'undefined') {
      const targetPath = v === 'signup' ? '/signup' : '/login'
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath)
      }
    }
  }

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginCaptcha, setLoginCaptcha] = useState('')
  const [signupCaptcha, setSignupCaptcha] = useState('')
  const [captchaVersion, setCaptchaVersion] = useState(0)

  // Signup form state (Customer only)
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: 'Dubai',
    area: '',
    address: '',
    password: '',
  })

  const registerCustomerMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async (r) => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Registration failed')
        return res
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(`Welcome to Khobra Cleaning, ${signupForm.name}! Account created.`)
      if (data.user) setUser({ ...data.user, expiresAt: data.expiresAt })
      setView('dashboard')
      window.history.replaceState(null, '', '/')
    },
    onError: (err: any) => {
      setSignupCaptcha('')
      setCaptchaVersion(version => version + 1)
      toast.error(err.message || 'Failed to register customer')
    },
  })

  const loginMut = useMutation({
    mutationFn: (d: any) =>
      fetch('/api/khobra-cleaning/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }).then(async (r) => {
        const res = await r.json()
        if (!r.ok) throw new Error(res.error || 'Login failed')
        return res
      }),
    onSuccess: (data) => {
      if (data.user) setUser({ ...data.user, expiresAt: data.expiresAt })
      setView('dashboard')
      window.history.replaceState(null, '', '/')
    },
    onError: (err: any) => {
      setLoginCaptcha('')
      setCaptchaVersion(version => version + 1)
      toast.error(err.message || 'Login failed')
    },
  })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail) {
      toast.error('Please enter an email')
      return
    }
    if (!loginCaptcha) return toast.error('Please complete the security check')
    loginMut.mutate({ email: loginEmail.trim().toLowerCase(), password: loginPassword, turnstileToken: loginCaptcha })
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupForm.name || !signupForm.email || !signupForm.phone || signupForm.password.length < 8) {
      toast.error('Fill all required fields and use at least 8 password characters')
      return
    }
    if (!signupCaptcha) return toast.error('Please complete the security check')
    registerCustomerMut.mutate({
      name: signupForm.name,
      email: signupForm.email.trim().toLowerCase(),
      phone: signupForm.phone,
      city: signupForm.city,
      area: signupForm.area,
      address: signupForm.address,
      password: signupForm.password,
      turnstileToken: signupCaptcha,
    })
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6 space-y-2">
          <Logo size={44} showText={true} className="justify-center mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In to Khobra Cleaning</h1>
          <p className="text-sm text-muted-foreground">
            Khobra Operations & Customer Portal
          </p>
        </div>

        <Card className="border-0 shadow-xl backdrop-blur-xl bg-card/90 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
          <CardContent className="p-4 sm:p-6">
            <Tabs value={tab} onValueChange={(v) => handleTabChange(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6">
                <TabsTrigger value="login" className="min-h-11 gap-2">
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </TabsTrigger>
                <TabsTrigger value="signup" className="min-h-11 gap-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Customer Signup</span>
                </TabsTrigger>
              </TabsList>

              {/* Universal Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-semibold">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="h-11 pl-9"
                        placeholder="user@khobra.ae"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-semibold">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="h-11 pl-9"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <Turnstile key={`login-${captchaVersion}`} onVerify={setLoginCaptcha} />

                  <Button type="submit" disabled={!loginCaptcha || loginMut.isPending} className="h-11 w-full gap-2 bg-emerald-600 font-medium hover:bg-emerald-700">
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

              </TabsContent>

              {/* Customer Only Signup Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2 mb-2">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Customer Registration only. Cleaners & Drivers are created by Admin.</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs font-semibold">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        name="name"
                        autoComplete="name"
                        value={signupForm.name}
                        onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                        placeholder="John Doe"
                        className="h-11 pl-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[400px]:grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-semibold">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={signupForm.email}
                          onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                          placeholder="john@example.com"
                          className="h-11 pl-9 text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-xs font-semibold">Phone *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          value={signupForm.phone}

                          onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                          placeholder="+971 50..."
                          className="h-11 pl-9 text-xs"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 min-[400px]:grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-city" className="text-xs font-semibold">City</Label>
                      <Select
                        name="city"
                        value={signupForm.city}
                        onValueChange={(v) => setSignupForm({ ...signupForm, city: v })}
                      >
                        <SelectTrigger id="signup-city" className="min-h-11 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dubai">Dubai</SelectItem>
                          <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                          <SelectItem value="Sharjah">Sharjah</SelectItem>
                          <SelectItem value="Ajman">Ajman</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-area" className="text-xs font-semibold">Area</Label>
                      <Input
                        id="signup-area"
                        name="area"
                        value={signupForm.area}
                        onChange={(e) => setSignupForm({ ...signupForm, area: e.target.value })}
                        placeholder="e.g. Marina / Downtown"
                        className="h-11 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-address" className="text-xs font-semibold">Street Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-address"
                        name="address"
                        autoComplete="street-address"
                        value={signupForm.address}
                        onChange={(e) => setSignupForm({ ...signupForm, address: e.target.value })}
                        placeholder="Building 4, Apt 1201..."
                        className="h-11 pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-xs font-semibold">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        placeholder="Create password"
                        className="h-11 pl-9 text-xs"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <Turnstile key={`signup-${captchaVersion}`} onVerify={setSignupCaptcha} />

                  <Button
                    type="submit"
                    className="mt-2 h-11 w-full gap-2 bg-emerald-600 text-xs font-medium hover:bg-emerald-700"
                    disabled={!signupCaptcha || registerCustomerMut.isPending}
                  >
                    {registerCustomerMut.isPending ? 'Creating Customer Account...' : 'Create Customer Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
