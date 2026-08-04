import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { loadBookings } from '../application/bookings'
import type { Session } from '../domain/auth/types'
import type { Booking, DriverTrip } from '../domain/bookings/types'
import { khobraBookingGateway } from '../infrastructure/http/khobra-gateways'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

export function BookingsScreen({ session, onNewBooking }: { session: Session; onNewBooking: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [trips, setTrips] = useState<DriverTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null)
  const [overallRating, setOverallRating] = useState(5)
  const [cleanerRatings, setCleanerRatings] = useState<Record<string, number>>({})
  const [ratingComment, setRatingComment] = useState('')
  const [cleanerDateScope, setCleanerDateScope] = useState<'today' | 'all'>('today')
  const [driverScope, setDriverScope] = useState<'today' | 'completed' | 'pending' | 'upcoming'>('today')
  const [issueBooking, setIssueBooking] = useState<Booking | null>(null)
  const [issueDescription, setIssueDescription] = useState('')

  useEffect(() => {
    loadBookings(khobraBookingGateway, session.token)
      .then(setBookings)
      .catch((error) => Alert.alert('Could not load bookings', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }, [session.token])

  useEffect(() => {
    if (session.user.role === 'driver') khobraBookingGateway.getTrips(session.token).then(setTrips).catch(() => undefined)
  }, [session.token, session.user.role])

  if (loading) return <LoadingState label="Loading bookings..." />
  const today = new Date().toDateString()
  const visibleBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.scheduledDate)
    if (session.user.role === 'cleaner') return cleanerDateScope === 'all' || bookingDate.toDateString() === today
    if (session.user.role !== 'driver') return true
    if (driverScope === 'today') return bookingDate.toDateString() === today
    if (driverScope === 'completed') return bookingDate.toDateString() === today && booking.status === 'completed'
    if (driverScope === 'pending') return bookingDate.toDateString() === today && ['pending', 'pending_assignment', 'assigned', 'scheduled', 'confirmed'].includes(booking.status)
    return bookingDate >= new Date(new Date().setHours(0, 0, 0, 0)) && !['completed', 'cancelled', 'no_show'].includes(booking.status)
  })
  const upcomingStops = trips.flatMap(trip => new Date(trip.date) >= new Date(new Date().setHours(0, 0, 0, 0)) && trip.status !== 'completed' ? (trip.stops || []).filter(stop => stop.status !== 'completed').map(stop => ({ ...stop, tripDate: trip.date })) : [])
  return <>
  <FlatList
    contentContainerStyle={styles.list}
    data={visibleBookings}
    keyExtractor={(booking) => booking.id}
    ListHeaderComponent={<><PageHeading title="Bookings" subtitle="Your upcoming and recent cleaning visits." action={['admin', 'customer'].includes(session.user.role) ? <Pressable accessibilityRole="button" onPress={onNewBooking} style={styles.addButton}><Ionicons name="add" size={22} color="#fff" /></Pressable> : undefined} />{session.user.role === 'cleaner' ? <View style={styles.scopeTabs}><Pressable onPress={() => setCleanerDateScope('today')} style={[styles.scopeTab, cleanerDateScope === 'today' && styles.scopeTabActive]}><Text style={[styles.scopeTabText, cleanerDateScope === 'today' && styles.scopeTabTextActive]}>Today</Text></Pressable><Pressable onPress={() => setCleanerDateScope('all')} style={[styles.scopeTab, cleanerDateScope === 'all' && styles.scopeTabActive]}><Text style={[styles.scopeTabText, cleanerDateScope === 'all' && styles.scopeTabTextActive]}>All Assigned</Text></Pressable></View> : null}{session.user.role === 'driver' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeTabs}>{([['today', 'Today'], ['completed', 'Completed Today'], ['pending', 'Pending Today'], ['upcoming', 'Upcoming Pickups / Drop-offs']] as const).map(([scope, label]) => <Pressable key={scope} onPress={() => setDriverScope(scope)} style={[styles.scopeTab, driverScope === scope && styles.driverScopeActive]}><Text style={[styles.scopeTabText, driverScope === scope && styles.scopeTabTextActive]}>{label}</Text></Pressable>)}</ScrollView> : null}{session.user.role === 'driver' && driverScope === 'upcoming' ? <View style={styles.transportStops}><Text style={styles.transportTitle}>Assigned transport stops</Text>{upcomingStops.length === 0 ? <Text style={styles.transportEmpty}>No upcoming pickup or drop-off stops.</Text> : upcomingStops.map(stop => <View key={stop.id} style={styles.transportStop}><Ionicons name="location-outline" size={17} color="#7c3aed" /><View style={{ flex: 1 }}><Text style={styles.transportType}>{stop.type || 'Stop'}</Text><Text style={styles.transportAddress}>{stop.address || 'Address not provided'} · {new Date(stop.tripDate).toLocaleDateString('en-AE')}</Text></View></View>)}</View> : null}</>}
    ListEmptyComponent={<MessageState icon="calendar-outline" title="No bookings yet" detail="Your scheduled cleaning visits will appear here." action={session.user.role === 'customer' ? <Pressable onPress={onNewBooking} style={styles.emptyAction}><Text style={styles.emptyActionText}>Book a service</Text></Pressable> : undefined} />}
    renderItem={({ item }) => <BookingCard booking={item} role={session.user.role} cleanerName={session.user.name} updating={updating === item.id} onReportIssue={() => { setIssueBooking(item); setIssueDescription('') }} onRate={() => {
      if (item.rating) {
        const cleanerSummary = (item.assignments || []).map(assignment => `${assignment.employee?.user?.name || 'Assigned cleaner'}: ${assignment.customerRating || '-'} / 5 stars`).join('\n')
        Alert.alert('Rating Submitted', `Overall service: ${item.rating.overallRating} / 5 stars\n${cleanerSummary}\n${item.rating.comment || 'No written comment'}\nSubmitted: ${new Date(item.rating.submittedAt).toLocaleString('en-AE')}`)
        return
      }
      setOverallRating(5)
      setCleanerRatings(Object.fromEntries((item.assignments || []).map(assignment => [assignment.employeeId, 5])))
      setRatingComment('')
      setRatingBooking(item)
    }} onComplete={async () => {
      try {
        setUpdating(item.id)
        const result = await khobraBookingGateway.completeBooking(item.id, session.token)
        setBookings(await loadBookings(khobraBookingGateway, session.token))
        Alert.alert('Booking Completed', `Completed at ${new Date(result.completedAt).toLocaleString('en-AE')}. Payment remains pending until the customer completes payment.`)
      } catch (error) {
        Alert.alert('Booking not completed', error instanceof Error ? error.message : 'Try again.')
      } finally {
        setUpdating(null)
      }
    }} onCash={async () => {
      try {
        setUpdating(item.id)
        const receipt = await khobraBookingGateway.receiveCash(item.id, session.token)
        setBookings(await loadBookings(khobraBookingGateway, session.token))
        Alert.alert('Cash Received', `AED ${receipt.amountReceived} was recorded successfully.`)
      } catch (error) {
        Alert.alert('Cash not recorded', error instanceof Error ? error.message : 'Try again.')
      } finally {
        setUpdating(null)
      }
    }} onPayment={async method => {
      try {
        setUpdating(item.id)
        await khobraBookingGateway.selectPaymentMethod(item.id, method, session.token)
        setBookings(await loadBookings(khobraBookingGateway, session.token))
        Alert.alert('Payment method selected', method === 'cash' ? 'Pay Cash has been selected.' : 'Bank Transfer has been selected.')
      } catch (error) {
        Alert.alert('Payment method not selected', error instanceof Error ? error.message : 'Try again.')
      } finally {
        setUpdating(null)
      }
    }} onTiming={async withinScheduledTime => {
      try {
        setUpdating(item.id)
        const response = await khobraBookingGateway.submitCompletionTiming(item.id, withinScheduledTime, session.token)
        setBookings(current => current.map(booking => booking.id === item.id ? { ...booking, completionTimingResponses: [response, ...(booking.completionTimingResponses || [])] } : booking))
      } catch (error) {
        Alert.alert('Response not recorded', error instanceof Error ? error.message : 'Try again.')
      } finally {
        setUpdating(null)
      }
    }} onStatus={async status => {
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
  <Modal visible={Boolean(issueBooking)} transparent animationType="slide" onRequestClose={() => setIssueBooking(null)}>
    <View style={styles.modalBackdrop}><View style={styles.ratingModal}><View style={styles.ratingContent}><Text style={styles.ratingTitle}>Report Customer Issue</Text><Text style={styles.ratingSubtitle}>{issueBooking?.bookingNo} · {issueBooking?.customer?.user?.name || issueBooking?.customer?.name || 'Customer'}</Text><TextInput value={issueDescription} onChangeText={setIssueDescription} multiline maxLength={2000} placeholder="Describe what happened with the customer..." style={styles.issueInput} /><View style={styles.ratingActions}><Pressable onPress={() => setIssueBooking(null)} style={styles.ratingCancel}><Text style={styles.ratingCancelText}>Cancel</Text></Pressable><Pressable disabled={issueDescription.trim().length < 5 || Boolean(updating)} onPress={async () => { if (!issueBooking) return; setUpdating(issueBooking.id); try { await khobraBookingGateway.reportCustomerIssue(issueBooking.id, issueDescription.trim(), session.token); Alert.alert('Issue reported', 'The customer issue was sent to Admin.'); setIssueBooking(null); setIssueDescription('') } catch (error) { Alert.alert('Could not report issue', error instanceof Error ? error.message : 'Try again.') } finally { setUpdating(null) } }} style={[styles.ratingSubmit, issueDescription.trim().length < 5 && { opacity: 0.5 }]}><Text style={styles.ratingSubmitText}>Submit Issue</Text></Pressable></View></View></View></View>
  </Modal>
  <Modal visible={Boolean(ratingBooking)} transparent animationType="slide" onRequestClose={() => setRatingBooking(null)}>
    <View style={styles.modalBackdrop}>
      <View style={styles.ratingModal}>
        <ScrollView contentContainerStyle={styles.ratingContent}>
          <Text style={styles.ratingTitle}>Rate Service & Cleaners</Text>
          <Text style={styles.ratingSubtitle}>{ratingBooking?.bookingNo} · Select 1 to 5 stars</Text>
          <Text style={styles.ratingLabel}>Overall service</Text>
          <StarSelector value={overallRating} onChange={setOverallRating} />
          {(ratingBooking?.assignments || []).map(assignment => <View key={assignment.id} style={styles.cleanerRating}>
            <Text style={styles.ratingLabel}>{assignment.employee?.user?.name || 'Assigned cleaner'}</Text>
            <StarSelector value={cleanerRatings[assignment.employeeId] || 5} onChange={rating => setCleanerRatings(current => ({ ...current, [assignment.employeeId]: rating }))} />
          </View>)}
          <Text style={styles.ratingLabel}>Comment (optional)</Text>
          <TextInput multiline maxLength={2000} value={ratingComment} onChangeText={setRatingComment} placeholder="Share your service experience" placeholderTextColor={palette.muted} style={styles.ratingInput} />
          <View style={styles.ratingActions}>
            <Pressable disabled={Boolean(updating)} onPress={() => setRatingBooking(null)} style={styles.ratingCancel}><Text style={styles.ratingCancelText}>Cancel</Text></Pressable>
            <Pressable disabled={Boolean(updating)} onPress={async () => {
              if (!ratingBooking) return
              try {
                setUpdating(ratingBooking.id)
                await khobraBookingGateway.submitRating(ratingBooking.id, overallRating, ratingComment.trim(), (ratingBooking.assignments || []).map(assignment => ({ employeeId: assignment.employeeId, rating: cleanerRatings[assignment.employeeId] || 5 })), session.token)
                setBookings(await loadBookings(khobraBookingGateway, session.token))
                setRatingBooking(null)
                Alert.alert('Thank you', 'Your rating has been submitted.')
              } catch (error) {
                Alert.alert('Rating not submitted', error instanceof Error ? error.message : 'Try again.')
              } finally {
                setUpdating(null)
              }
            }} style={styles.ratingSubmit}><Text style={styles.ratingSubmitText}>{updating ? 'Submitting...' : 'Submit Rating'}</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>
  </>
}

function StarSelector({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return <View style={styles.stars}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="button" accessibilityLabel={`${star} stars`} onPress={() => onChange(star)}><Ionicons name={star <= value ? 'star' : 'star-outline'} size={30} color="#f59e0b" /></Pressable>)}</View>
}

function BookingCard({ booking, role, cleanerName, updating, onStatus, onTiming, onPayment, onCash, onComplete, onRate, onReportIssue }: { booking: Booking; role: Session['user']['role']; cleanerName: string; updating: boolean; onStatus: (status: string) => void; onTiming: (withinScheduledTime: boolean) => void; onPayment: (method: 'cash' | 'bank_transfer') => void; onCash: () => void; onComplete: () => void; onRate: () => void; onReportIssue: () => void }) {
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
  const tone = statusTones[booking.status.toLowerCase()] || statusTones.default
  const paidAmount = booking.invoices?.[0]?.paidAmount || 0
  const remainingPayable = Math.max(0, booking.netAmount - paidAmount)
  const paymentStatus = booking.invoices?.[0]?.payments?.[0]?.status
  const cashPayment = booking.invoices?.[0]?.payments?.find(payment => payment.method === 'cash')
  const cashSelected = booking.invoices?.[0]?.selectedPaymentMethod === 'cash' || cashPayment?.status === 'cash_selected'
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
    {role === 'driver' && ['scheduled', 'confirmed'].includes(booking.status) ? <Pressable disabled={updating} onPress={() => Alert.alert('Confirm On the Way', 'Confirm that you are now on the way to this booking?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => onStatus('on_the_way') }])} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Updating...' : 'Mark On the Way'}</Text></Pressable> : null}
    {role === 'cleaner' && booking.status === 'on_the_way' ? <Pressable disabled={updating} onPress={() => onStatus('in_progress')} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Updating...' : 'Start Work'}</Text></Pressable> : null}
    {role === 'cleaner' && booking.status === 'in_progress' ? <Pressable disabled={updating} onPress={() => Alert.alert('Confirm Completion Within Scheduled Time', 'Select the expected completion timing.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes — within scheduled time', onPress: () => onTiming(true) }, { text: 'No — additional time required', onPress: () => onTiming(false) }])} style={styles.timingAction}><Text style={styles.timingActionText}>Confirm Completion Within Scheduled Time</Text></Pressable> : null}
    {(role === 'admin' || role === 'driver') && booking.completionTimingResponses?.[0] ? <View style={styles.timingResult}><Text style={styles.timingResultTitle}>Latest completion timing</Text><Text style={styles.timingResultText}>{booking.completionTimingResponses[0].withinScheduledTime ? 'Yes — expected within scheduled time' : 'No — additional time may be required'}</Text><Text style={styles.timingResultMeta}>{booking.completionTimingResponses[0].employee?.user?.name || 'Cleaner'} · {new Date(booking.completionTimingResponses[0].createdAt).toLocaleString('en-AE')}</Text></View> : null}
    {role === 'cleaner' && booking.status === 'in_progress' ? <Pressable disabled={updating} onPress={() => Alert.alert('Complete Booking', 'Confirm that all work is finished and mark this booking Completed?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Complete Booking', onPress: onComplete }])} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Completing...' : 'Complete Booking'}</Text></Pressable> : null}
    {booking.status === 'completed' && role === 'customer' && remainingPayable > 0 && !['verified', 'paid'].includes(paymentStatus || '') ? <Pressable disabled={updating} onPress={() => Alert.alert('Select Payment Method', `Booking amount: AED ${booking.totalAmount}\nAdjustments: AED ${(booking.netAmount - booking.totalAmount).toFixed(2)}\nAlready paid: AED ${paidAmount}\nRemaining payable: AED ${remainingPayable}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Pay Cash', onPress: () => onPayment('cash') }, { text: 'Bank Transfer', onPress: () => onPayment('bank_transfer') }])} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Recording...' : 'Select Payment Method'}</Text></Pressable> : null}
    {booking.status === 'completed' && role === 'customer' ? <Pressable disabled={updating} onPress={onRate} style={styles.ratingAction}><Ionicons name="star" size={16} color="#92400e" /><Text style={styles.ratingActionText}>{booking.rating ? 'View Rating' : 'Rate Service & Cleaners'}</Text></Pressable> : null}
    {role === 'cleaner' && booking.assignments?.[0]?.customerRating ? <View style={styles.timingResult}><Text style={styles.timingResultTitle}>Your customer rating</Text><Text style={styles.timingResultText}>{booking.assignments[0].customerRating} / 5 stars</Text></View> : null}
    {booking.status === 'completed' && role === 'cleaner' && cashSelected && remainingPayable > 0 ? <Pressable disabled={updating} onPress={() => Alert.alert('Confirm Cash Collection', `Booking reference: ${booking.bookingNo}\nCustomer: ${booking.customer?.user?.name || booking.customer?.name || 'Customer'}\nAmount: AED ${remainingPayable}\nCurrency: AED\nCleaner receiving cash: ${cleanerName}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm Cash Received', onPress: onCash }])} style={styles.statusAction}><Text style={styles.statusActionText}>{updating ? 'Recording...' : `Mark Cash Received (AED ${remainingPayable})`}</Text></Pressable> : null}
    {role === 'cleaner' && cashPayment && ['verified', 'paid'].includes(cashPayment.status) ? <View style={styles.timingResult}><Text style={styles.timingResultTitle}>Cash Received</Text><Text style={styles.timingResultText}>{cashPayment.receivedAt || cashPayment.verifiedAt ? new Date(cashPayment.receivedAt || cashPayment.verifiedAt!).toLocaleString('en-AE') : 'Recorded'}</Text></View> : null}
    {role === 'cleaner' ? <Pressable onPress={onReportIssue} style={styles.issueAction}><Ionicons name="warning-outline" size={16} color="#be123c" /><Text style={styles.issueActionText}>Report Issue Regarding Customer</Text></Pressable> : null}
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
  timingAction: { alignSelf: 'stretch', borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#eff6ff', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10, marginTop: 2 },
  timingActionText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  timingResult: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 11, gap: 3 },
  timingResultTitle: { color: palette.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  timingResultText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  timingResultMeta: { color: palette.muted, fontSize: 11 },
  emptyAction: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  emptyActionText: { color: '#fff', fontWeight: '700' },
  ratingAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  ratingActionText: { color: '#92400e', fontWeight: '800', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  ratingModal: { maxHeight: '88%', backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  ratingContent: { padding: 22, paddingBottom: 34, gap: 14 },
  ratingTitle: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  ratingSubtitle: { color: palette.muted, fontSize: 13 },
  ratingLabel: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 8 },
  cleanerRating: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 13, gap: 9 },
  ratingInput: { minHeight: 90, borderWidth: 1, borderColor: palette.border, borderRadius: 13, padding: 12, color: palette.ink, textAlignVertical: 'top' },
  ratingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  ratingCancel: { borderWidth: 1, borderColor: palette.border, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11 },
  ratingCancelText: { color: palette.ink, fontWeight: '700' },
  ratingSubmit: { backgroundColor: palette.primary, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11 },
  ratingSubmitText: { color: '#fff', fontWeight: '800' },
  scopeTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  scopeTab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  scopeTabActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  driverScopeActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  transportStops: { marginBottom: 14, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', gap: 8 },
  transportTitle: { color: '#5b21b6', fontSize: 13, fontWeight: '800' },
  transportEmpty: { color: palette.muted, fontSize: 12 },
  transportStop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#ede9fe' },
  transportType: { color: palette.ink, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  transportAddress: { color: palette.muted, fontSize: 11, marginTop: 2 },
  scopeTabText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  scopeTabTextActive: { color: '#fff' },
  issueAction: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 9 },
  issueActionText: { color: '#be123c', fontSize: 12, fontWeight: '800' },
  issueInput: { minHeight: 120, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, textAlignVertical: 'top', color: palette.ink, backgroundColor: palette.surfaceMuted },
})
