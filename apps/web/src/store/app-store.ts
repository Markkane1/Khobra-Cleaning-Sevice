import { create } from 'zustand'

type ViewId =
  | 'dashboard'
  | 'services'
  | 'customers'
  | 'employees'
  | 'bookings'
  | 'finance'
  | 'driver_expenses'
  | 'dispatch'
  | 'inventory'
  | 'reports'
  | 'complaints'
  | 'settings'
  | 'attendance'
  | 'payroll'
  | 'branches'
  | 'rbac'
  | 'login'
  | 'signup'
  | 'profile'
  | 'company_bank_accounts'
  | 'notifications'

type RoleId = 'admin' | 'customer' | 'cleaner' | 'driver'

export interface UserProfile {
  userId: string
  name: string
  email: string
  role: RoleId
  expiresAt: number
}

interface AppState {
  currentView: ViewId
  currentRole: RoleId
  currentUser: UserProfile | null
  sidebarOpen: boolean
  setView: (view: ViewId) => void
  setRole: (role: RoleId) => void
  setUser: (user: UserProfile | null) => void
  logout: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'login',
  currentRole: 'admin',
  currentUser: null,
  sidebarOpen: false,
  setView: (view) => set({ currentView: view }),
  setRole: (role) => set({ currentRole: role }),
  setUser: (user) => set({ currentUser: user, currentRole: user?.role || 'admin' }),
  logout: () => set({ currentUser: null, currentRole: 'admin', currentView: 'login', sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

export type { ViewId, RoleId }
