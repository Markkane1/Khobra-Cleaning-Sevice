import { useEffect, useState } from 'react'
import { Alert, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { loadDashboard } from './src/application/dashboard'
import type { Session } from './src/domain/auth/types'
import type { DashboardStats } from './src/domain/dashboard/types'
import type { PickupAlert } from './src/domain/bookings/types'
import type { OperationModule } from './src/domain/operations/types'
import { khobraBookingGateway, khobraDashboardGateway } from './src/infrastructure/http/khobra-gateways'
import { secureSessionStore } from './src/infrastructure/storage/secure-session-store'
import { AuthScreen } from './src/presentation/auth-screen'
import { BookingsScreen } from './src/presentation/bookings-screen'
import { cardShadow, headingFont, LoadingState, PageHeading, palette } from './src/presentation/mobile-ui'
import { NewBookingScreen } from './src/presentation/new-booking-screen'
import { OperationsScreen } from './src/presentation/operations-screen'
import { DriverExpensesScreen } from './src/presentation/driver-expenses-screen'
import { ServicesScreen } from './src/presentation/services-screen'
import { CustomersScreen } from './src/presentation/customers-screen'
import { EmployeesScreen } from './src/presentation/employees-screen'
import { InventoryScreen } from './src/presentation/inventory-screen'
import { ComplaintsScreen } from './src/presentation/complaints-screen'
import { AttendanceScreen } from './src/presentation/attendance-screen'
import { InvoicesScreen } from './src/presentation/invoices-screen'
import { NotificationsScreen } from './src/presentation/notifications-screen'
import { AdminHubScreen } from './src/presentation/admin-hub-screen'
import { BranchesScreen } from './src/presentation/branches-screen'
import { PayrollScreen } from './src/presentation/payroll-screen'
import { RbacScreen } from './src/presentation/rbac-screen'
import { SettingsScreen } from './src/presentation/settings-screen'
import { ReportsScreen } from './src/presentation/reports-screen'
import { DispatchScreen } from './src/presentation/dispatch-screen'
import { ProfileScreen } from './src/presentation/profile-screen'
import { apiBaseUrl, setUnauthorizedHandler } from './src/infrastructure/http/api-client'
import { registerNativePush } from './src/infrastructure/notifications/native-push'

type MainScreen = 'overview' | 'bookings' | 'expenses' | 'operations' | 'admin'
type Screen = MainScreen | 'new-booking' | 'services' | 'customers' | 'employees' | 'inventory' | 'complaints' | 'attendance' | 'invoices' | 'notifications' | 'dispatch' | 'payroll' | 'branches' | 'rbac' | 'settings' | 'reports' | 'profile'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    secureSessionStore.read().then(setSession).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await secureSessionStore.clear()
      setSession(null)
    })
    return () => setUnauthorizedHandler()
  }, [])

  useEffect(() => {
    if (!session) return
    const timeout = setTimeout(() => {
      void secureSessionStore.clear().finally(() => setSession(null))
    }, Math.max(0, session.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [session])

  useEffect(() => {
    if (session) void registerNativePush(session.token).catch(error => console.warn('Push registration failed', error))
  }, [session])

  if (loading) return <SafeAreaView style={styles.screen}><LoadingState /></SafeAreaView>

  const signOut = async () => {
    try {
      if (session?.token && apiBaseUrl) {
        await fetch(`${apiBaseUrl}/api/khobra-cleaning/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        }).catch(() => null)
      }
    } catch {}
    await secureSessionStore.clear()
    setSession(null)
  }


  return session ? <Dashboard session={session} onSignOut={signOut} /> : <AuthScreen onSignedIn={setSession} />
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [screenHistory, setScreenHistory] = useState<Screen[]>(['overview'])
  const screen = screenHistory[screenHistory.length - 1]
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pickupAlerts, setPickupAlerts] = useState<PickupAlert[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    loadDashboard(khobraDashboardGateway, session.token)
      .then(setStats)
      .catch((error) => Alert.alert('Could not load dashboard', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }

  const refreshPickupAlerts = () => session.user.role === 'driver' && khobraBookingGateway.getPickupAlerts(session.token).then(setPickupAlerts).catch(() => undefined)
  const navigate = (next: Screen) => setScreenHistory(current => current[current.length - 1] === next ? current : [...current, next])
  const goBack = () => setScreenHistory(current => current.length > 1 ? current.slice(0, -1) : current)

  useEffect(refresh, [session.token])
  useEffect(() => {
    if (session.user.role !== 'driver') return
    void refreshPickupAlerts()
    const timer = setInterval(refreshPickupAlerts, 10000)
    return () => clearInterval(timer)
  }, [session.token, session.user.role])
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenHistory.length <= 1) return false
      goBack()
      return true
    })
    return () => subscription.remove()
  }, [screenHistory.length])

  return <SafeAreaView style={styles.screen}>
    <View style={styles.glow} />
    <AppHeader session={session} onSignOut={onSignOut} onBack={goBack} canGoBack={screenHistory.length > 1} />
    <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {screen === 'overview' ? <Overview stats={stats} loading={loading} pickupAlerts={pickupAlerts.filter(alert => !alert.viewedAt)} onRefresh={refresh} onPickupViewed={async id => { await khobraBookingGateway.markPickupAlertViewed(id, session.token); setPickupAlerts(current => current.filter(alert => alert.id !== id)) }} /> : null}
      {screen === 'bookings' ? <BookingsScreen session={session} onNewBooking={() => navigate('new-booking')} /> : null}
      {screen === 'new-booking' ? <NewBookingScreen session={session} onCreated={goBack} onCancel={goBack} onAddAddress={() => navigate('profile')} /> : null}
      {screen === 'operations' ? <OperationsScreen session={session} onNavigate={navigate} /> : null}
      {screen === 'services' ? <ServicesScreen session={session} /> : null}
      {screen === 'customers' ? <CustomersScreen session={session} /> : null}
      {screen === 'employees' ? <EmployeesScreen session={session} /> : null}
      {screen === 'inventory' ? <InventoryScreen session={session} /> : null}
      {screen === 'complaints' ? <ComplaintsScreen session={session} /> : null}
      {screen === 'attendance' ? <AttendanceScreen session={session} /> : null}
      {screen === 'invoices' ? <InvoicesScreen session={session} /> : null}
      {screen === 'notifications' ? <NotificationsScreen session={session} /> : null}
      {screen === 'expenses' ? <DriverExpensesScreen session={session} /> : null}
      {screen === 'admin' ? <AdminHubScreen session={session} onNavigate={navigate as any} /> : null}
      {screen === 'branches' ? <BranchesScreen session={session} /> : null}
      {screen === 'payroll' ? <PayrollScreen session={session} /> : null}
      {screen === 'rbac' ? <RbacScreen session={session} /> : null}
      {screen === 'settings' ? <SettingsScreen session={session} /> : null}
      {screen === 'reports' ? <ReportsScreen session={session} /> : null}
      {screen === 'dispatch' ? <DispatchScreen session={session} /> : null}
      {screen === 'profile' ? <ProfileScreen session={session} /> : null}
    </KeyboardAvoidingView>
    <BottomNavigation screen={['new-booking', 'services', 'customers', 'employees', 'inventory', 'complaints', 'attendance', 'invoices', 'notifications'].includes(screen) ? 'operations' : (['dispatch', 'payroll', 'branches', 'rbac', 'settings', 'reports', 'profile'].includes(screen) ? 'admin' : screen as MainScreen)} role={session.user.role} onChange={navigate} />
  </SafeAreaView>
}

function AppHeader({ session, onSignOut, onBack, canGoBack }: { session: Session; onSignOut: () => void; onBack: () => void; canGoBack: boolean }) {
  return <View style={styles.header}>
    <Pressable accessibilityLabel="Go back" accessibilityRole="button" accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed, !canGoBack && styles.backButtonDisabled]}><Ionicons name="arrow-back" size={22} color={palette.primaryDark} /></Pressable>
    <View style={styles.identity}>
      <View style={styles.headerLogo}><Image source={require('./assets/logo.png')} resizeMode="contain" style={styles.logo} /></View>
      <View style={styles.userText}><Text style={styles.eyebrow}>KHOBRA CLEANING</Text><Text style={styles.userName} numberOfLines={1}>Hello, {session.user.name}</Text></View>
    </View>
    <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}><Ionicons name="log-out-outline" size={21} color={palette.primaryDark} /></Pressable>
  </View>
}

function Overview({ stats, loading, pickupAlerts, onRefresh, onPickupViewed }: { stats: DashboardStats | null; loading: boolean; pickupAlerts: PickupAlert[]; onRefresh: () => void; onPickupViewed: (id: string) => Promise<void> }) {
  if (loading) return <LoadingState label="Refreshing your overview..." />
  return <ScrollView contentContainerStyle={styles.overview}>
    <PageHeading title="Overview" subtitle="A quick look at today’s cleaning operations." action={<Pressable accessibilityLabel="Refresh overview" onPress={onRefresh} style={styles.refresh}><Ionicons name="refresh" size={20} color={palette.primaryDark} /></Pressable>} />

    {pickupAlerts.map(alert => <View key={alert.id} style={styles.pickupAlert}>
      <Text style={styles.pickupPriority}>HIGH PRIORITY PICKUP</Text>
      <Text style={styles.pickupTitle}>Proceed or prepare for pickup — {alert.booking.bookingNo}</Text>
      <Text style={styles.pickupDetail}>{alert.customerLocation}</Text>
      <Text style={styles.pickupDetail}>Scheduled end: {alert.scheduledEndTime || 'Not provided'}</Text>
      <Text style={styles.pickupDetail}>Cleaners: {alert.assignedCleanerNames || 'Not provided'}</Text>
      <Text style={styles.pickupTime}>Generated {new Date(alert.generatedAt).toLocaleString('en-AE')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void onPickupViewed(alert.id)} style={styles.pickupButton}><Text style={styles.pickupButtonText}>Acknowledge</Text></Pressable>
    </View>)}

    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}><View><Text style={styles.heroLabel}>TOTAL REVENUE</Text><Text style={styles.revenue}>{(stats?.totalRevenue ?? 0).toLocaleString()}</Text></View><View style={styles.trend}><Ionicons name="trending-up" size={17} color="#a7f3d0" /><Text style={styles.trendText}>Live</Text></View></View>
      <View style={styles.heroStats}>
        <HeroStat label="Today" value={stats?.todayBookings ?? 0} />
        <View style={styles.heroDivider} />
        <HeroStat label="Completed" value={stats?.completedBookings ?? 0} />
        <View style={styles.heroDivider} />
        <HeroStat label="Total bookings" value={stats?.totalBookings ?? 0} />
      </View>
    </View>

    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Operations snapshot</Text><Text style={styles.sectionCaption}>LIVE</Text></View>
    <View style={styles.grid}>
      <Metric icon="calendar-outline" label="Today’s bookings" value={stats?.todayBookings} tint="#ecfdf5" color="#059669" />
      <Metric icon="hourglass-outline" label="Pending bookings" value={stats?.pendingBookings} tint="#fffbeb" color="#d97706" />
      <Metric icon="people-outline" label="Active cleaners" value={stats?.activeEmployees} tint="#ecfeff" color="#0891b2" />
      <Metric icon="chatbubble-ellipses-outline" label="Open complaints" value={stats?.openComplaints} tint="#fff1f2" color="#e11d48" />
      <Metric icon="checkmark-done-outline" label="Completed" value={stats?.completedBookings} tint="#f0fdf4" color="#16a34a" />
      <Metric icon="briefcase-outline" label="All bookings" value={stats?.totalBookings} tint="#f5f3ff" color="#7c3aed" />
    </View>
  </ScrollView>
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return <View style={styles.heroStat}><Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>
}

function Metric({ icon, label, value, tint, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: number | undefined; tint: string; color: string }) {
  return <View style={styles.metric}>
    <View style={[styles.metricIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={21} color={color} /></View>
    <Text style={styles.metricValue}>{value ?? 0}</Text><Text style={styles.metricLabel}>{label}</Text>
  </View>
}

function BottomNavigation({ screen, role, onChange }: { screen: MainScreen; role: Session['user']['role']; onChange: (screen: Screen) => void }) {
  return <View style={styles.nav}>
    {navigation.filter(item => item.id !== 'expenses' || role === 'driver').map((item) => {
      const active = screen === item.id
      return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => onChange(item.id)} style={styles.navItem}>
        <View style={[styles.navIcon, active && styles.activeNavIcon]}><Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? '#fff' : palette.muted} /></View>
        <Text style={[styles.navLabel, active && styles.activeNavLabel]}>{item.label}</Text>
      </Pressable>
    })}
  </View>
}

const navigation: ReadonlyArray<{ id: MainScreen; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { id: 'overview', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'operations', label: 'Operations', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'admin', label: 'Admin', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt-outline', activeIcon: 'receipt' },
]

const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { flex: 1 },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: palette.tealSoft, top: -130, right: -90, opacity: 0.55 },
  header: { minHeight: 76 + statusBarHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: statusBarHeight, borderBottomWidth: 1, borderBottomColor: '#e4eee9' },
  backButton: { width: 44, height: 44, marginRight: 10, borderRadius: 14, borderWidth: 1, borderColor: '#cce1d7', backgroundColor: '#ffffffcc', alignItems: 'center', justifyContent: 'center' },
  backButtonDisabled: { opacity: 0.35 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerLogo: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: palette.primarySoft, ...cardShadow },
  logo: { width: '100%', height: '100%' },
  userText: { flex: 1 },
  eyebrow: { color: palette.primaryDark, fontSize: 12, fontWeight: '800', letterSpacing: 0.9 },
  userName: { color: palette.ink, fontFamily: headingFont, fontSize: 18, fontWeight: '700', marginTop: 2 },
  signOut: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#cce1d7', backgroundColor: '#ffffffcc', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  overview: { padding: 20, paddingBottom: 112 },
  refresh: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  pickupAlert: { borderWidth: 2, borderColor: '#dc2626', backgroundColor: '#fef2f2', borderRadius: 20, padding: 17, gap: 6, marginBottom: 16 },
  pickupPriority: { color: '#b91c1c', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  pickupTitle: { color: '#7f1d1d', fontSize: 16, fontWeight: '800' },
  pickupDetail: { color: '#991b1b', fontSize: 12 },
  pickupTime: { color: '#b45309', fontSize: 12 },
  pickupButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', backgroundColor: '#dc2626', borderRadius: 11, paddingHorizontal: 14, marginTop: 5 },
  pickupButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  hero: { overflow: 'hidden', backgroundColor: '#064e3b', borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#064e3b', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#10b981', opacity: 0.24, top: -85, right: -50 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { color: '#a7f3d0', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  revenue: { color: '#fff', fontFamily: headingFont, fontSize: 28, fontWeight: '700', marginTop: 5 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff18', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  trendText: { color: '#d1fae5', fontSize: 12, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#ffffff25' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: '#a7f3d0', fontSize: 12, marginTop: 4 },
  heroDivider: { width: 1, height: 32, backgroundColor: '#ffffff25' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: palette.ink, fontFamily: headingFont, fontSize: 18, fontWeight: '700' },
  sectionCaption: { color: palette.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: '46%', minHeight: 136, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 15, ...cardShadow },
  metricIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  metricValue: { color: palette.ink, fontFamily: headingFont, fontSize: 24, fontWeight: '800' },
  metricLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  nav: { position: 'absolute', left: 14, right: 14, bottom: 10, minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 8, borderRadius: 24, backgroundColor: '#fffffffa', borderWidth: 1, borderColor: '#dce9e3', shadowColor: '#064e3b', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navIcon: { width: 36, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeNavIcon: { backgroundColor: palette.primary },
  navLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  activeNavLabel: { color: palette.primaryDark },
})
