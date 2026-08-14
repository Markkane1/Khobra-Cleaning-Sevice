import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette, SelectButton } from './mobile-ui'

type AttendanceRecord = { id: string; employeeId: string; date: string; clockIn: string; clockOut?: string; status: string; employee?: { user?: { name: string } } }
type Employee = { id: string; user?: { name: string } }

export function AttendanceScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const [clockEmployeeId, setClockEmployeeId] = useState('')
  const [pickerVisible, setPickerVisible] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      request<AttendanceRecord[]>('/api/khobra-cleaning/attendance', {}, session.token),
      request<Employee[]>('/api/khobra-cleaning/employees', {}, session.token)
    ]).then(([resAtt, resEmp]) => {
      setRecords(resAtt)
      setEmployees(resEmp)
      if (session.user.role === 'cleaner' && resEmp.length > 0) {
        setClockEmployeeId(resEmp[0].id)
      }
    }).catch(() => Alert.alert('Error', 'Could not load attendance data.'))
    .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const formatToday = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const handleClockIn = async () => {
    if (!clockEmployeeId) return Alert.alert('Error', 'Select an employee first.')
    setActionLoading(true)
    try {
      await request('/api/khobra-cleaning/attendance', {
        method: 'POST',
        body: JSON.stringify({ employeeId: clockEmployeeId, date: formatToday(), clockIn: new Date().toISOString(), status: 'present' })
      }, session.token)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!clockEmployeeId) return Alert.alert('Error', 'Select an employee first.')
    const today = formatToday()
    const activeRecord = records.find(r => r.employeeId === clockEmployeeId && r.date.startsWith(today) && r.clockIn && !r.clockOut)
    
    if (!activeRecord) return Alert.alert('Error', 'Must clock in before clocking out.')

    setActionLoading(true)
    try {
      await request('/api/khobra-cleaning/attendance', {
        method: 'PUT',
        body: JSON.stringify({ id: activeRecord.id, clockOut: new Date().toISOString(), status: 'present' })
      }, session.token)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--'
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (s: string) => {
    if (s === 'present') return '#10b981'
    if (s === 'absent') return '#ef4444'
    if (s === 'leave') return '#f59e0b'
    return '#f97316'
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Attendance" subtitle="Cleaner attendance and time tracking" />
      
      <View style={styles.clockCard}>
        <Text style={styles.clockTitle}>Clock In / Out</Text>
        <SelectButton label="Select Cleaner" value={employees.find(e => e.id === clockEmployeeId)?.user?.name || ''} onPress={() => setPickerVisible(true)} />
        <View style={styles.clockActions}>
          <Pressable style={[styles.clockBtn, styles.btnIn, actionLoading && {opacity: 0.5}]} onPress={handleClockIn} disabled={actionLoading}>
            <Ionicons name="log-in-outline" size={20} color="#fff" /><Text style={styles.clockBtnText}>Clock In</Text>
          </Pressable>
          <Pressable style={[styles.clockBtn, styles.btnOut, actionLoading && {opacity: 0.5}]} onPress={handleClockOut} disabled={actionLoading}>
            <Ionicons name="log-out-outline" size={20} color={palette.primaryDark} /><Text style={[styles.clockBtnText, {color: palette.primaryDark}]}>Clock Out</Text>
          </Pressable>
        </View>
      </View>
    </View>

    {loading ? <LoadingState label="Loading records..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={records}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="calendar-outline" title="No Records" detail="No attendance data found." />}
      renderItem={({ item: r }) => <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.employeeName}>{r.employee?.user?.name || 'Unknown'}</Text>
          <View style={[styles.badge, { backgroundColor: getStatusColor(r.status) + '20' }]}><Text style={[styles.badgeText, { color: getStatusColor(r.status) }]}>{r.status}</Text></View>
        </View>
        <Text style={styles.dateText}>{new Date(r.date).toLocaleDateString()}</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeBox}><Text style={styles.timeLabel}>Clock In</Text><Text style={styles.timeVal}>{formatTime(r.clockIn)}</Text></View>
          <View style={styles.timeBox}><Text style={styles.timeLabel}>Clock Out</Text><Text style={styles.timeVal}>{formatTime(r.clockOut)}</Text></View>
        </View>
      </View>}
    />}
    
    <Modal visible={pickerVisible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Select Cleaner</Text>
          <ScrollView style={styles.optionsList}>{employees.map(e => <Pressable key={e.id} style={styles.optionRow} onPress={() => { setClockEmployeeId(e.id); setPickerVisible(false); }}><Text style={styles.optionText}>{e.user?.name || 'Unknown'}</Text></Pressable>)}</ScrollView>
          <Pressable style={styles.optionCancel} onPress={() => setPickerVisible(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  clockCard: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, marginTop: 10, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  clockTitle: { fontSize: 14, fontWeight: '700', color: palette.ink, marginBottom: 12 },
  clockActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  clockBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12 },
  btnIn: { backgroundColor: palette.primary },
  btnOut: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.primary },
  clockBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  employeeName: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: palette.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  dateText: { fontSize: 14, color: palette.muted, marginBottom: 12 },
  timeRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  timeBox: { flex: 1 },
  timeLabel: { fontSize: 12, color: palette.muted, fontWeight: '600', marginBottom: 2 },
  timeVal: { fontSize: 16, fontWeight: '700', color: palette.ink },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 20 },
  optionsBox: { maxHeight: '85%', backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsList: { flexShrink: 1 },
  optionsTitle: { padding: 20, fontSize: 18, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
