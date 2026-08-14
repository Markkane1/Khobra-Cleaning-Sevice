import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Complaint = { id: string; complaintNo: string; customer?: { user?: { name: string } }; category: string; priority: string; description: string; status: string; createdAt: string; resolution?: string; booking?: { bookingNo: string } }
type Customer = { id: string; user?: { name: string } }

export function ComplaintsScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [formCustomer, setFormCustomer] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPriority, setFormPriority] = useState('medium')
  const [formDescription, setFormDescription] = useState('')
  const [formStatus, setFormStatus] = useState('open')
  const [formResolution, setFormResolution] = useState('')

  const [pickerType, setPickerType] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      request<Complaint[]>('/api/khobra-cleaning/complaints', {}, session.token),
      request<Customer[]>('/api/khobra-cleaning/customers', {}, session.token)
    ]).then(([resCmp, resCust]) => {
      setComplaints(resCmp)
      setCustomers(resCust)
    }).catch(() => Alert.alert('Error', 'Could not load complaints.'))
    .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    if (!formCategory || !formDescription) return Alert.alert('Validation', 'Please provide category and description.')
    setSaving(true)
    try {
      const payload = editId ? { id: editId, status: formStatus, resolution: formResolution } : { customerId: formCustomer, category: formCategory, priority: formPriority, description: formDescription, status: 'open' }
      await request('/api/khobra-cleaning/complaints', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }, session.token)
      setFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = (id: string) => {
    Alert.alert('Delete Complaint', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await request(`/api/khobra-cleaning/complaints?id=${id}`, { method: 'DELETE' }, session.token)
          load()
        } catch (e) { Alert.alert('Error', 'Failed to delete.') }
      }}
    ])
  }

  const openNew = () => {
    setEditId(null)
    setFormCustomer('')
    setFormCategory('')
    setFormPriority('medium')
    setFormDescription('')
    setFormStatus('open')
    setFormResolution('')
    setFormOpen(true)
  }

  const openEdit = (c: Complaint) => {
    setEditId(c.id)
    setFormStatus(c.status)
    setFormResolution(c.resolution || '')
    setFormOpen(true)
  }

  const getPriorityColor = (p: string) => {
    if (p === 'critical') return '#ef4444'
    if (p === 'high') return '#f97316'
    if (p === 'medium') return '#f59e0b'
    return '#6b7280'
  }

  const categories = ['Customer Issue', 'Service Quality', 'Staff Behavior', 'Billing', 'Scheduling', 'Other']
  const priorities = ['low', 'medium', 'high', 'critical']
  const statuses = ['open', 'in_progress', 'resolved', 'closed']

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Complaints" subtitle="Track and resolve customer issues" action={<Pressable accessibilityRole="button" accessibilityLabel="Add complaint" onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>

    {loading ? <LoadingState label="Loading complaints..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={complaints}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="alert-circle-outline" title="No complaints" detail="All clear! No customer issues reported." />}
      renderItem={({ item: c }) => <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getPriorityColor(c.priority) }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{c.complaintNo}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{c.status.replace('_', ' ')}</Text></View>
        </View>
        <Text style={styles.customerName}>{c.customer?.user?.name || 'Unknown Customer'}</Text>
        <Text style={styles.description}>{c.description}</Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{new Date(c.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={[styles.metaText, { color: getPriorityColor(c.priority), fontWeight: '700' }]}>{c.priority}</Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>{c.category}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => openEdit(c)}><Ionicons name="create-outline" size={16} color={palette.primaryDark} /><Text style={styles.actionBtnText}>Manage</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete complaint ${c.complaintNo}`} style={styles.iconBtn} onPress={() => remove(c.id)}><Ionicons name="trash" size={16} color={palette.danger} /></Pressable>
        </View>
      </View>}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Manage Complaint' : 'File Complaint'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close complaint form" onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          {!editId ? <>
            <View style={styles.formGroup}>
              <FormLabel label="Customer *" />
              <SelectButton label="Select Customer" value={customers.find(c => c.id === formCustomer)?.user?.name || ''} onPress={() => setPickerType('customer')} />
            </View>
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Category *" /><SelectButton label="Category" value={formCategory} onPress={() => setPickerType('category')} /></View>
              <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Priority" /><SelectButton label="Priority" value={formPriority} onPress={() => setPickerType('priority')} /></View>
            </View>
            <View style={styles.formGroup}><FormLabel label="Description *" /><Input value={formDescription} onChangeText={setFormDescription} placeholder="Describe the issue..." multiline /></View>
          </> : <>
            <View style={styles.formGroup}><FormLabel label="Update Status" /><SelectButton label="Status" value={formStatus.replace('_', ' ')} onPress={() => setPickerType('status')} /></View>
            <View style={styles.formGroup}><FormLabel label="Resolution Details" /><Input value={formResolution} onChangeText={setFormResolution} placeholder="How was this resolved?" multiline /></View>
          </>}
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editId ? 'Update Complaint' : 'Submit Complaint'} onPress={save} loading={saving} />
        </View>
      </SafeAreaView>
      
      {/* Dynamic Picker Modal */}
      <Modal visible={!!pickerType} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Select</Text>
            <ScrollView style={styles.optionsList}>
              {pickerType === 'customer' && customers.map(c => <Pressable key={c.id} style={styles.optionRow} onPress={() => { setFormCustomer(c.id); setPickerType(null); }}><Text style={styles.optionText}>{c.user?.name || 'Unknown'}</Text></Pressable>)}
              {pickerType === 'category' && categories.map(c => <Pressable key={c} style={styles.optionRow} onPress={() => { setFormCategory(c); setPickerType(null); }}><Text style={styles.optionText}>{c}</Text></Pressable>)}
              {pickerType === 'priority' && priorities.map(c => <Pressable key={c} style={styles.optionRow} onPress={() => { setFormPriority(c); setPickerType(null); }}><Text style={styles.optionText}>{c}</Text></Pressable>)}
              {pickerType === 'status' && statuses.map(c => <Pressable key={c} style={styles.optionRow} onPress={() => { setFormStatus(c); setPickerType(null); }}><Text style={styles.optionText}>{c.replace('_', ' ')}</Text></Pressable>)}
            </ScrollView>
            <Pressable style={styles.optionCancel} onPress={() => setPickerType(null)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, ...cardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '800', fontFamily: 'Courier New', color: palette.muted },
  badge: { backgroundColor: palette.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: palette.muted, textTransform: 'uppercase' },
  customerName: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 8 },
  description: { fontSize: 14, color: palette.ink, lineHeight: 20, marginBottom: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 },
  metaText: { fontSize: 12, color: palette.muted, fontWeight: '600', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  actionBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.primarySoft, paddingHorizontal: 12, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: palette.primaryDark },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formBody: { padding: 20, gap: 16 },
  formGroup: {},
  row: { gap: 14 },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 20 },
  optionsBox: { maxHeight: '85%', backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsList: { flexShrink: 1 },
  optionsTitle: { padding: 20, fontSize: 18, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
