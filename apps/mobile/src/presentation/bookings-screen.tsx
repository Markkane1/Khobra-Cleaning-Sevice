import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { loadBookings } from '../application/bookings'
import type { Session } from '../domain/auth/types'
import type { Booking } from '../domain/bookings/types'
import { khobraBookingGateway } from '../infrastructure/http/khobra-gateways'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

export function BookingsScreen({ session, onNewBooking }: { session: Session; onNewBooking: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadBookings(khobraBookingGateway, session.token)
      .then(setBookings)
      .catch((error) => Alert.alert('Could not load bookings', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }, [session.token])

  if (loading) return <LoadingState label="Loading bookings..." />
  return <FlatList
    contentContainerStyle={styles.list}
    data={bookings}
    keyExtractor={(booking) => booking.id}
    ListHeaderComponent={<PageHeading title="Bookings" subtitle="Your upcoming and recent cleaning visits." action={['admin', 'customer'].includes(session.user.role) ? <Pressable accessibilityRole="button" onPress={onNewBooking} style={styles.addButton}><Ionicons name="add" size={22} color="#fff" /></Pressable> : undefined} />}
    ListEmptyComponent={<MessageState icon="calendar-outline" title="No bookings yet" detail="Your scheduled cleaning visits will appear here." action={session.user.role === 'customer' ? <Pressable onPress={onNewBooking} style={styles.emptyAction}><Text style={styles.emptyActionText}>Book a service</Text></Pressable> : undefined} />}
    renderItem={({ item }) => <BookingCard booking={item} role={session.user.role} updating={updating === item.id} onStatus={async status => {
      try {
        setUpdating(item.id)
        const updated = await khobraBookingGateway.updateStatus(item.id, status, session.token)
        setBookings(current => current.map(booking => booking.id === updated.id ? updated : booking))
      } catch (error) {
        Alert.alert('Status not updated', error instanceof Error ? error.message : 'Invalid status transition.')
      } finally {
        setUpdating(null)
      }
    }} />}
  />
}

function BookingCard({ booking, role, updating, onStatus }: { booking: Booking; role: Session['user']['role']; updating: boolean; onStatus: (status: string) => void }) {
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
  const tone = statusTones[booking.status.toLowerCase()] || statusTones.default
  return <View style={styles.card}>
    <View style={styles.cardTop}>
      <View style={styles.bookingIcon}><Ionicons name="sparkles-outline" size={20} color={palette.primary} /></View>
      <View style={styles.cardTitle}><Text style={styles.service}>{booking.service?.name || 'Cleaning service'}</Text><Text style={styles.number}>{booking.bookingNo}</Text></View>
      <View style={[styles.status, { backgroundColor: tone.background }]}><Text style={[styles.statusText, { color: tone.text }]}>{booking.status.replace(/_/g, ' ')}</Text></View>
    </View>
    <View style={styles.divider} />
    <View style={styles.detailRow}><Ionicons name="calendar-outline" size={17} color={palette.muted} /><Text style={styles.detail}>{date}</Text></View>
    <View style={styles.detailRow}><Ionicons name="time-outline" size={17} color={palette.muted} /><Text style={styles.detail}>{booking.startTime} – {booking.endTime}</Text></View>
    {booking.customer?.name ? <View style={styles.detailRow}><Ionicons name="person-outline" size={17} color={palette.muted} /><Text style={styles.detail}>{booking.customer.name}</Text></View> : null}
    {(role === 'driver' || role === 'admin') && ['scheduled', 'confirmed'].includes(booking.status) ? <Pressable disabled={updating} onPress={() => onStatus('on_the_way')} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Updating...' : 'Mark On the Way'}</Text></Pressable> : null}
    {(role === 'cleaner' || role === 'admin') && booking.status === 'on_the_way' ? <Pressable disabled={updating} onPress={() => onStatus('in_progress')} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Updating...' : 'Start Service'}</Text></Pressable> : null}
    {(role === 'cleaner' || role === 'admin') && booking.status === 'in_progress' ? <Pressable disabled={updating} onPress={() => onStatus('completed')} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Updating...' : 'Mark Completed'}</Text></Pressable> : null}
  </View>
}

const statusTones: Record<string, { background: string; text: string }> = {
  completed: { background: '#d1fae5', text: '#047857' },
  confirmed: { background: '#cffafe', text: '#0e7490' },
  scheduled: { background: '#ccfbf1', text: '#0f766e' },
  on_the_way: { background: '#cffafe', text: '#0e7490' },
  pending_assignment: { background: '#fef3c7', text: '#b45309' },
  assigned: { background: '#dbeafe', text: '#1d4ed8' },
  pending: { background: '#fef3c7', text: '#b45309' },
  cancelled: { background: '#fee2e2', text: '#b91c1c' },
  in_progress: { background: '#ffedd5', text: '#c2410c' },
  default: { background: palette.surfaceMuted, text: palette.inkSoft },
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 20, paddingBottom: 110, gap: 13 },
  addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 7, elevation: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 17, gap: 10, ...cardShadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bookingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  cardTitle: { flex: 1 },
  service: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  number: { color: palette.muted, fontSize: 12, marginTop: 3 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: '#edf2ef', marginVertical: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detail: { color: palette.muted, fontSize: 13 },
  statusAction: { alignSelf: 'flex-start', backgroundColor: palette.primary, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2 },
  statusActionText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  emptyAction: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  emptyActionText: { color: '#fff', fontWeight: '700' },
})
