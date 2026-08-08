import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

type Driver = { id: string; driverCode: string; status: string; user: { name: string; email: string }; phone: string; vehicleInfo: string }
type Trip = { id: string; date: string; status: string; driver: Driver; stops: any[] }

export function DispatchScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch(`${apiBaseUrl}/api/khobra-cleaning/drivers`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
      fetch(`${apiBaseUrl}/api/khobra-cleaning/trips`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json())
    ])
      .then(([d, t]) => {
        setDrivers(d)
        setTrips(t)
      })
      .catch(() => Alert.alert('Error', 'Could not load dispatch data.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const updateTripStatus = async (tripId: string, status: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/trips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ id: tripId, status })
      })
      if (!res.ok) throw new Error('Failed to update trip')
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Dispatch" subtitle="Fleet & Trip Management" />
    </View>

    {loading ? <LoadingState label="Loading dispatch board..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={trips}
      keyExtractor={item => item.id}
      ListHeaderComponent={() => (
        <View style={styles.driversRow}>
          <Text style={styles.sectionTitle}>Available Drivers ({drivers.filter(d => d.status === 'active').length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverScroll}>
            {drivers.map(d => (
              <View key={d.id} style={styles.driverChip}>
                <View style={[styles.statusDot, { backgroundColor: d.status === 'active' ? '#10b981' : '#9ca3af' }]} />
                <Text style={styles.driverName}>{d.user?.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      ListEmptyComponent={<MessageState icon="bus-outline" title="No Trips" detail="No active trips found." />}
      renderItem={({ item: t }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.tripDate}>{new Date(t.date).toLocaleDateString()}</Text>
              <Text style={styles.tripDriver}>{t.driver?.user?.name || 'Unassigned'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: t.status === 'completed' ? '#d1fae5' : t.status === 'in_progress' ? '#ffedd5' : '#e0f2fe' }]}>
              <Text style={[styles.badgeText, { color: t.status === 'completed' ? '#047857' : t.status === 'in_progress' ? '#c2410c' : '#0369a1' }]}>
                {t.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
          
          <View style={styles.stopsArea}>
            <Text style={styles.stopsLabel}>Stops ({t.stops?.length || 0})</Text>
          </View>

          <View style={styles.actionsRow}>
            {t.status === 'planned' && <Pressable style={[styles.btn, styles.btnStart]} onPress={() => updateTripStatus(t.id, 'in_progress')}>
              <Text style={styles.btnStartText}>Start Trip</Text>
            </Pressable>}
            {t.status === 'in_progress' && <Pressable style={[styles.btn, styles.btnComplete]} onPress={() => updateTripStatus(t.id, 'completed')}>
              <Text style={styles.btnCompleteText}>Complete Trip</Text>
            </Pressable>}
          </View>
        </View>
      )}
    />}
  </View>
}

import { ScrollView } from 'react-native'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  
  list: { padding: 20, gap: 16, paddingBottom: 100 },
  
  driversRow: { marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.ink, marginBottom: 10 },
  driverScroll: { gap: 8 },
  driverChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: palette.border },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  driverName: { fontSize: 13, fontWeight: '600', color: palette.ink },
  
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  tripDate: { fontSize: 12, color: palette.muted, marginBottom: 2 },
  tripDriver: { fontSize: 16, fontWeight: '700', color: palette.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  
  stopsArea: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, marginBottom: 14 },
  stopsLabel: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  
  actionsRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnStart: { backgroundColor: '#ffedd5' },
  btnStartText: { color: '#c2410c', fontWeight: '700', fontSize: 13 },
  btnComplete: { backgroundColor: '#d1fae5' },
  btnCompleteText: { color: '#047857', fontWeight: '700', fontSize: 13 },
})
