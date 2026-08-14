import { useEffect, useState } from 'react'
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

type Driver = { id: string; driverCode: string; status: string; user: { name: string; email: string }; phone: string; vehicleInfo: string }
type Trip = { id: string; date: string; status: string; driver: Driver; stops: any[] }
type Booking = { id: string; bookingNo: string; startTime: string; status: string; driverId?: string; customer?: { user?: { name?: string } } }

export function DispatchScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      request<Driver[]>('/api/khobra-cleaning/drivers', {}, session.token),
      request<Trip[]>('/api/khobra-cleaning/trips', {}, session.token),
      request<Booking[]>('/api/khobra-cleaning/bookings', {}, session.token)
    ])
      .then(([d, t, b]) => {
        setDrivers(d)
        setTrips(t)
        setBookings(b)
      })
      .catch(() => Alert.alert('Error', 'Could not load dispatch data.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const updateTripStatus = async (tripId: string, status: string) => {
    try {
      await request('/api/khobra-cleaning/trips', {
        method: 'PUT',
        body: JSON.stringify({ id: tripId, status })
      }, session.token)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }
  const assignDriver = async (bookingId: string, driverId: string) => { try { await request('/api/khobra-cleaning/bookings', { method: 'PUT', body: JSON.stringify({ id: bookingId, driverId }) }, session.token); load() } catch (error: any) { Alert.alert('Assignment unavailable', error.message) } }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Dispatch" subtitle="Fleet & Trip Management" />
    </View>

    {loading ? <LoadingState label="Loading dispatch board..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={trips}
      keyExtractor={item => item.id}
      ListHeaderComponent={() => (<>
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
        {session.user.role === 'admin' && <View style={styles.queue}><Text style={styles.sectionTitle}>Driver assignment queue</Text>{bookings.filter(b => !b.driverId && ['pending_assignment', 'assigned', 'scheduled'].includes(b.status)).map(b => <View key={b.id} style={styles.queueRow}><Text style={styles.queueText}>{b.bookingNo} · {b.startTime}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverScroll}>{drivers.filter(driver => driver.status === 'active').map(driver => <Pressable key={driver.id} style={styles.assign} onPress={() => assignDriver(b.id, driver.id)}><Text style={styles.assignText}>{driver.user?.name}</Text></Pressable>)}</ScrollView></View>)}</View>}
      </>)}
      ListEmptyComponent={<MessageState icon="bus-outline" title="No Trips" detail="No active trips found." />}
      renderItem={({ item: t }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderInfo}>
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
            {t.stops?.map((stop: any, index: number) => <Pressable key={stop.id || index} style={styles.stop} onPress={() => stop.latitude && stop.longitude ? Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`) : stop.address ? Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`) : undefined}>
              <Ionicons name={stop.completedAt ? 'checkmark-circle' : 'location-outline'} size={18} color={stop.completedAt ? palette.primary : palette.muted} /><View style={{ flex: 1 }}><Text style={styles.stopTitle}>{index + 1}. {stop.type || 'Service stop'}{stop.completedAt ? ' · Arrived' : ''}</Text><Text style={styles.stopAddress}>{stop.address || 'Address unavailable'}</Text></View><Ionicons name="navigate-outline" size={18} color={palette.primary} />
            </Pressable>)}
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
  queue: { marginBottom: 14, gap: 8 }, queueRow: { backgroundColor: palette.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: palette.border }, queueText: { fontSize: 14, fontWeight: '700', color: palette.ink, marginBottom: 7 }, assign: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.primarySoft }, assignText: { fontSize: 12, fontWeight: '700', color: palette.primaryDark },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.ink, marginBottom: 10 },
  driverScroll: { gap: 8 },
  driverChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: palette.border },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  driverName: { fontSize: 14, fontWeight: '600', color: palette.ink },
  
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardHeaderInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  tripDate: { fontSize: 12, color: palette.muted, marginBottom: 2 },
  tripDriver: { fontSize: 16, fontWeight: '700', color: palette.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  
  stopsArea: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, marginBottom: 14 },
  stopsLabel: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  stop: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 8, paddingTop: 8 },
  stopTitle: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  stopAddress: { fontSize: 12, color: palette.muted, marginTop: 2 },
  
  actionsRow: { flexDirection: 'row', gap: 10 },
  btn: { minHeight: 44, flex: 1, justifyContent: 'center', borderRadius: 10, alignItems: 'center' },
  btnStart: { backgroundColor: '#ffedd5' },
  btnStartText: { color: '#c2410c', fontWeight: '700', fontSize: 14 },
  btnComplete: { backgroundColor: '#d1fae5' },
  btnCompleteText: { color: '#047857', fontWeight: '700', fontSize: 14 },
})
