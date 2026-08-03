import { useEffect, useState } from 'react'
import { Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { loadDashboard } from './src/application/dashboard'
import type { Session } from './src/domain/auth/types'
import type { DashboardStats } from './src/domain/dashboard/types'
import { khobraDashboardGateway } from './src/infrastructure/http/khobra-gateways'
import { secureSessionStore } from './src/infrastructure/storage/secure-session-store'
import { AuthScreen } from './src/presentation/auth-screen'
import { BookingsScreen } from './src/presentation/bookings-screen'
import { cardShadow, headingFont, LoadingState, PageHeading, palette } from './src/presentation/mobile-ui'
import { NewBookingScreen } from './src/presentation/new-booking-screen'
import { OperationsScreen } from './src/presentation/operations-screen'
import { clearWorkspaceSession, WorkspaceScreen } from './src/presentation/workspace-screen'

type MainScreen = 'overview' | 'bookings' | 'operations' | 'workspace'
type Screen = MainScreen | 'new-booking'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    secureSessionStore.read().then(setSession).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!session) return
    const timeout = setTimeout(() => {
      void Promise.all([clearWorkspaceSession(), secureSessionStore.clear()]).finally(() => setSession(null))
    }, Math.max(0, session.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [session])

  if (loading) return <SafeAreaView style={styles.screen}><LoadingState /></SafeAreaView>

  const signOut = async () => {
    await clearWorkspaceSession()
    await secureSessionStore.clear()
    setSession(null)
  }

  return session ? <Dashboard session={session} onSignOut={signOut} /> : <AuthScreen onSignedIn={setSession} />
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [screen, setScreen] = useState<Screen>('overview')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    loadDashboard(khobraDashboardGateway, session.token)
      .then(setStats)
      .catch((error) => Alert.alert('Could not load dashboard', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [session.token])

  return <SafeAreaView style={styles.screen}>
    <View style={styles.glow} />
    <AppHeader session={session} onSignOut={onSignOut} />
    <View style={styles.body}>
      {screen === 'overview' ? <Overview stats={stats} loading={loading} onRefresh={refresh} /> : null}
      {screen === 'bookings' ? <BookingsScreen session={session} onNewBooking={() => setScreen('new-booking')} /> : null}
      {screen === 'new-booking' ? <NewBookingScreen session={session} onCreated={() => setScreen('bookings')} onCancel={() => setScreen('bookings')} /> : null}
      {screen === 'operations' ? <OperationsScreen session={session} /> : null}
      {screen === 'workspace' ? <WorkspaceScreen session={session} /> : null}
    </View>
    <BottomNavigation screen={screen === 'new-booking' ? 'bookings' : screen} onChange={setScreen} />
  </SafeAreaView>
}

function AppHeader({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return <View style={styles.header}>
    <View style={styles.identity}>
      <View style={styles.headerLogo}><Image source={require('./assets/logo.png')} resizeMode="contain" style={styles.logo} /></View>
      <View style={styles.userText}><Text style={styles.eyebrow}>KHOBRA CLEANING</Text><Text style={styles.userName} numberOfLines={1}>Hello, {session.user.name}</Text></View>
    </View>
    <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}><Ionicons name="log-out-outline" size={21} color={palette.primaryDark} /></Pressable>
  </View>
}

function Overview({ stats, loading, onRefresh }: { stats: DashboardStats | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return <LoadingState label="Refreshing your overview..." />
  return <ScrollView contentContainerStyle={styles.overview}>
    <PageHeading title="Overview" subtitle="A quick look at today’s cleaning operations." action={<Pressable accessibilityLabel="Refresh overview" onPress={onRefresh} style={styles.refresh}><Ionicons name="refresh" size={20} color={palette.primaryDark} /></Pressable>} />

    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}><View><Text style={styles.heroLabel}>TOTAL REVENUE</Text><Text style={styles.revenue}>AED {(stats?.totalRevenue ?? 0).toLocaleString()}</Text></View><View style={styles.trend}><Ionicons name="trending-up" size={17} color="#a7f3d0" /><Text style={styles.trendText}>Live</Text></View></View>
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

function BottomNavigation({ screen, onChange }: { screen: MainScreen; onChange: (screen: Screen) => void }) {
  return <View style={styles.nav}>
    {navigation.map((item) => {
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
  { id: 'workspace', label: 'Workspace', icon: 'globe-outline', activeIcon: 'globe' },
]

const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { flex: 1 },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: palette.tealSoft, top: -130, right: -90, opacity: 0.55 },
  header: { minHeight: 76 + statusBarHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: statusBarHeight, borderBottomWidth: 1, borderBottomColor: '#e4eee9' },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerLogo: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: palette.primarySoft, ...cardShadow },
  logo: { width: '100%', height: '100%' },
  userText: { flex: 1 },
  eyebrow: { color: palette.primaryDark, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  userName: { color: palette.ink, fontFamily: headingFont, fontSize: 17, fontWeight: '700', marginTop: 2 },
  signOut: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, borderColor: '#cce1d7', backgroundColor: '#ffffffcc', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  overview: { padding: 20, paddingBottom: 112 },
  refresh: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  hero: { overflow: 'hidden', backgroundColor: '#064e3b', borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#064e3b', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#10b981', opacity: 0.24, top: -85, right: -50 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { color: '#a7f3d0', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  revenue: { color: '#fff', fontFamily: headingFont, fontSize: 29, fontWeight: '700', marginTop: 5 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff18', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  trendText: { color: '#d1fae5', fontSize: 11, fontWeight: '700' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#ffffff25' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroStatLabel: { color: '#a7f3d0', fontSize: 10, marginTop: 4 },
  heroDivider: { width: 1, height: 32, backgroundColor: '#ffffff25' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: palette.ink, fontFamily: headingFont, fontSize: 17, fontWeight: '700' },
  sectionCaption: { color: palette.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1, backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: '46%', minHeight: 136, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 15, ...cardShadow },
  metricIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  metricValue: { color: palette.ink, fontFamily: headingFont, fontSize: 25, fontWeight: '800' },
  metricLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  nav: { position: 'absolute', left: 14, right: 14, bottom: 10, minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 8, borderRadius: 24, backgroundColor: '#fffffffa', borderWidth: 1, borderColor: '#dce9e3', shadowColor: '#064e3b', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navIcon: { width: 36, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeNavIcon: { backgroundColor: palette.primary },
  navLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  activeNavLabel: { color: palette.primaryDark },
})
