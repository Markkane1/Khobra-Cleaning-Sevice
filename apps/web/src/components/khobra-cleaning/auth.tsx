'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  LogIn, UserPlus, Lock, Mail, Phone, User, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { LoginSchema, SignupSchema } from '@repo/core'
import { useAppStore } from '@/store/app-store'
import { apiRequest } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Logo } from '@/components/ui/logo'
import { Turnstile } from './turnstile'

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
    password: '',
    confirmPassword: '',
  })

  const registerCustomerMut = useMutation({
    mutationFn: (d: any) =>
      apiRequest<any>('/api/khobra-cleaning/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
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
      apiRequest<any>('/api/khobra-cleaning/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
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

  const loginValidation = LoginSchema.safeParse({ email: loginEmail, password: loginPassword, turnstileToken: loginCaptcha })
  const signupValidation = SignupSchema.safeParse({ ...signupForm, turnstileToken: signupCaptcha })
  const showLoginValidation = Boolean(loginEmail || loginPassword)
  const showSignupValidation = Object.values(signupForm).some(Boolean)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginValidation.success) loginMut.mutate(loginValidation.data)
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    if (signupValidation.success) registerCustomerMut.mutate(signupValidation.data)
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

                  {(loginMut.error || (showLoginValidation && !loginValidation.success)) && (
                    <p className="text-sm text-destructive" role="alert">
                      {loginMut.error instanceof Error ? loginMut.error.message : !loginValidation.success ? loginValidation.error.issues[0]?.message : ''}
                    </p>
                  )}

                  <Button type="submit" disabled={!loginValidation.success || loginMut.isPending} className="h-11 w-full gap-2 bg-emerald-600 font-medium hover:bg-emerald-700">
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

              </TabsContent>

              {/* Customer Only Signup Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[['signup-password', 'Password', 'password'], ['signup-confirm-password', 'Confirm Password', 'confirmPassword']].map(([id, label, field]) => (
                      <div className="space-y-1.5" key={id}>
                        <Label htmlFor={id} className="text-xs font-semibold">{label} *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id={id} name={field} type="password" autoComplete="new-password" value={signupForm[field as 'password' | 'confirmPassword']} onChange={(e) => setSignupForm({ ...signupForm, [field]: e.target.value })} placeholder="At least 8 characters" className="h-11 pl-9 text-xs" minLength={8} required />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Turnstile key={`signup-${captchaVersion}`} onVerify={setSignupCaptcha} />

                  {(registerCustomerMut.error || (showSignupValidation && !signupValidation.success)) && (
                    <p className="text-sm text-destructive" role="alert">
                      {registerCustomerMut.error instanceof Error ? registerCustomerMut.error.message : !signupValidation.success ? signupValidation.error.issues[0]?.message : ''}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="mt-2 h-11 w-full gap-2 bg-emerald-600 text-xs font-medium hover:bg-emerald-700"
                    disabled={!signupValidation.success || registerCustomerMut.isPending}
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
