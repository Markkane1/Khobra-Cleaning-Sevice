import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Branch = { id: string; name: string; address: string; phone: string; status: string }

export function BranchesScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formStatus, setFormStatus] = useState('active')

  const [pickerOpen, setPickerOpen] = useState(false)

  const load = () => {
    setLoading(true)
    request<Branch[]>('/api/khobra-cleaning/branches', {}, session.token)
      .then(setBranches)
      .catch(() => Alert.alert('Error', 'Could not load branches.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const openNew = () => {
    setEditId(null)
    setFormName('')
    setFormAddress('')
    setFormPhone('')
    setFormStatus('active')
    setFormOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditId(b.id)
    setFormName(b.name || '')
    setFormAddress(b.address || '')
    setFormPhone(b.phone || '')
    setFormStatus(b.status || 'active')
    setFormOpen(true)
  }

  const save = async () => {
    if (!formName.trim()) return Alert.alert('Validation', 'Branch name is required.')
    setSaving(true)
    try {
      const payload = { id: editId, name: formName, address: formAddress, phone: formPhone, status: formStatus }
      await request('/api/khobra-cleaning/branches', {
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
    Alert.alert('Delete', 'Are you sure you want to delete this branch?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await request(`/api/khobra-cleaning/branches?id=${id}`, { method: 'DELETE' }, session.token)
          load()
        } catch (error) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Could not delete branch.')
        }
      }}
    ])
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Branches" subtitle="Manage locations" action={<Pressable accessibilityRole="button" accessibilityLabel="Add branch" onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>

    {loading ? <LoadingState label="Loading branches..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={branches}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="location-outline" title="No Branches" detail="Add your first company location." />}
      renderItem={({ item: b }) => (
        <Pressable style={styles.card} onPress={() => openEdit(b)}>
          <View style={styles.iconBox}><Ionicons name="location-outline" size={24} color={palette.primaryDark} /></View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{b.name}</Text>
              <View style={[styles.badge, { backgroundColor: b.status === 'active' ? '#d1fae5' : '#f3f4f6' }]}>
                <Text style={[styles.badgeText, { color: b.status === 'active' ? '#047857' : '#4b5563' }]}>{b.status}</Text>
              </View>
            </View>
            {!!b.address && <Text style={styles.detail} numberOfLines={1}><Ionicons name="map-outline" /> {b.address}</Text>}
            {!!b.phone && <Text style={styles.detail} numberOfLines={1}><Ionicons name="call-outline" /> {b.phone}</Text>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${b.name}`} style={styles.delBtn} onPress={() => remove(b.id)}><Ionicons name="trash-outline" size={18} color={palette.danger} /></Pressable>
        </Pressable>
      )}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Edit Branch' : 'New Branch'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close branch form" onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}>
            <FormLabel label="Branch Name *" />
            <Input value={formName} onChangeText={setFormName} placeholder="Downtown Branch" />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Address" />
            <Input value={formAddress} onChangeText={setFormAddress} placeholder="123 Main St" />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Phone" />
            <Input value={formPhone} onChangeText={setFormPhone} placeholder="+971..." />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Status" />
            <SelectButton label="Status" value={formStatus} onPress={() => setPickerOpen(true)} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editId ? 'Save Changes' : 'Add Branch'} onPress={save} loading={saving} />
        </View>
      </SafeAreaView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Select Status</Text>
            {['active', 'inactive'].map(s => (
              <Pressable key={s} style={styles.optionRow} onPress={() => { setFormStatus(s); setPickerOpen(false); }}>
                <Text style={styles.optionText}>{s}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.optionCancel} onPress={() => setPickerOpen(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow, gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: palette.ink },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detail: { fontSize: 14, color: palette.muted },
  delBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formBody: { padding: 20, gap: 16 },
  formGroup: {},
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 20 },
  optionsBox: { backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsTitle: { padding: 20, fontSize: 18, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink, textTransform: 'capitalize' },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
