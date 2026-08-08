import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, PageHeading, palette } from './mobile-ui'

type DashboardStats = {
  totalRevenue: number
  totalBookings: number
  completedBookings: number
  totalCustomers: number
  bookingStatusCounts: Record<string, number>
}

export function ReportsScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/dashboard`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(d => setStats(d.stats))
      .catch(() => Alert.alert('Error', 'Could not load reports.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const completionRate = stats && stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Ionicons name="arrow-back" size={24} color={palette.ink} onPress={onBack} style={styles.backButton} />}
      <PageHeading title="Reports" subtitle="Operational insights & analytics" />
    </View>

    {loading || !stats ? <LoadingState label="Gathering metrics..." /> : <ScrollView contentContainerStyle={styles.content}>
      
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiBox, { backgroundColor: palette.primary }]}>
          <Ionicons name="cash" size={24} color="#fff" />
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={styles.kpiVal}>AED {stats.totalRevenue.toLocaleString()}</Text>
        </View>

        <View style={[styles.kpiBox, { backgroundColor: palette.primaryDark }]}>
          <Ionicons name="briefcase" size={24} color="#fff" />
          <Text style={styles.kpiLabel}>Total Bookings</Text>
          <Text style={styles.kpiVal}>{stats.totalBookings.toLocaleString()}</Text>
          <Text style={styles.kpiSub}>{completionRate}% completion rate</Text>
        </View>

        <View style={[styles.kpiBox, { backgroundColor: '#0f766e' }]}>
          <Ionicons name="people" size={24} color="#fff" />
          <Text style={styles.kpiLabel}>Customers</Text>
          <Text style={styles.kpiVal}>{stats.totalCustomers.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>Booking Status Distribution</Text>
        <View style={styles.card}>
          {Object.entries(stats.bookingStatusCounts || {}).filter(([_,v])=>v>0).map(([status, count], i) => (
            <View key={status} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{status.replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.rowVal}>{count}</Text>
            </View>
          ))}
          {Object.keys(stats.bookingStatusCounts || {}).length === 0 && <Text style={styles.emptyText}>No bookings found.</Text>}
        </View>
      </View>

    </ScrollView>}
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  
  content: { padding: 20, gap: 24, paddingBottom: 100 },
  
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiBox: { width: '48%', padding: 16, borderRadius: 16, ...cardShadow },
  kpiLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 12, fontWeight: '600' },
  kpiVal: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  kpiSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  
  section: { gap: 12 },
  secTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  card: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: palette.border },
  rowLabel: { fontSize: 13, color: palette.muted, fontWeight: '600' },
  rowVal: { fontSize: 14, color: palette.ink, fontWeight: '800' },
  
  emptyText: { padding: 20, textAlign: 'center', color: palette.muted, fontSize: 13 },
})
