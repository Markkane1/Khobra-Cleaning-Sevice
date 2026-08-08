import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Employee = { id: string; employeeCode: string; user?: { name: string; email: string }; phone: string; address: string; city: string; area: string; skills: string; baseSalary: number; status: string; _count?: { assignments: number }; averageRating?: number; ratingCount?: number }

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', area: '', skills: '', baseSalary: '0', status: 'active', temporaryPassword: '' }

export function EmployeesScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [statusOptionsVisible, setStatusOptionsVisible] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/employees`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(setEmployees)
      .catch(() => Alert.alert('Error', 'Could not load employees.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    if (!form.name || !form.email) return Alert.alert('Validation', 'Please provide Name and Email.')
    setSaving(true)
    try {
      const payload = { ...form, baseSalary: Number(form.baseSalary) }
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/employees`, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload)
      })
      if (!res.ok) throw new Error('Failed to save employee')
      setFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = (id: string) => {
    Alert.alert('Remove Employee', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${apiBaseUrl}/api/khobra-cleaning/employees?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
          load()
        } catch (e) {
          Alert.alert('Error', 'Failed to delete.')
        }
      }}
    ])
  }

  const openEdit = (e: Employee) => {
    setEditId(e.id)
    setForm({ name: e.user?.name || '', email: e.user?.email || '', phone: e.phone || '', address: e.address || '', city: e.city || '', area: e.area || '', skills: e.skills || '', baseSalary: String(e.baseSalary || 0), status: e.status || 'active', temporaryPassword: '' })
    setFormOpen(true)
  }

  const openNew = () => {
    setEditId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const getInitials = (name?: string) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??'

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Cleaners" subtitle="Workforce management and skills tracking" action={<Pressable onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>

    {loading ? <LoadingState label="Loading cleaners..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={employees}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="people-outline" title="No cleaners found" detail="Add your first employee to get started." />}
      renderItem={({ item: e }) => <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(e.user?.name)}</Text></View>
          <View style={styles.cardInfo}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={styles.cardTitle}>{e.user?.name}</Text>
              <View style={[styles.statusDot, { backgroundColor: e.status === 'active' ? '#10b981' : e.status === 'on_leave' ? '#f59e0b' : '#9ca3af' }]} />
            </View>
            <Text style={styles.metaText}>{e.employeeCode}</Text>
            <View style={styles.metaRow}><Ionicons name="location-outline" size={12} color={palette.muted} /><Text style={styles.metaText}>{[e.area, e.city].filter(Boolean).join(', ') || 'No area assigned'}</Text></View>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>{e.status}</Text></View>
        </View>
        
        {e.skills ? <View style={styles.skillsBox}>
          {e.skills.split(',').slice(0, 4).map((s, i) => <View key={i} style={styles.skillPill}><Text style={styles.skillText}>{s.trim()}</Text></View>)}
        </View> : null}
        
        <View style={styles.actions}>
          <View style={styles.stats}>
            <View style={styles.statPill}><Ionicons name="briefcase-outline" size={12} color={palette.primaryDark} /><Text style={styles.statText}>{e._count?.assignments || 0} assignments</Text></View>
            {e.averageRating ? <View style={styles.statPill}><Ionicons name="star" size={12} color="#fbbf24" /><Text style={styles.statText}>{e.averageRating.toFixed(1)}</Text></View> : null}
          </View>
          <View style={styles.actionRow}>
            <Text style={styles.salary}>AED {e.baseSalary}</Text>
            <Pressable style={styles.iconButton} onPress={() => openEdit(e)}><Ionicons name="pencil" size={18} color={palette.primary} /></Pressable>
            <Pressable style={styles.iconButton} onPress={() => remove(e.id)}><Ionicons name="trash" size={18} color={palette.danger} /></Pressable>
          </View>
        </View>
      </View>}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Edit Cleaner' : 'Add New Cleaner'}</Text>
          <Pressable onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Full Name *" /><Input value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="John Doe" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Email *" /><Input value={form.email} onChangeText={t => setForm({ ...form, email: t })} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
          </View>
          {!editId && <View style={styles.formGroup}><FormLabel label="Temporary Password *" /><Input value={form.temporaryPassword} onChangeText={t => setForm({ ...form, temporaryPassword: t })} placeholder="min 8 chars" secureTextEntry /></View>}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Phone" /><Input value={form.phone} onChangeText={t => setForm({ ...form, phone: t })} placeholder="+971 50..." keyboardType="phone-pad" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Base Salary (AED)" /><Input value={form.baseSalary} onChangeText={t => setForm({ ...form, baseSalary: t })} keyboardType="numeric" /></View>
          </View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="City" /><Input value={form.city} onChangeText={t => setForm({ ...form, city: t })} placeholder="Dubai" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Area" /><Input value={form.area} onChangeText={t => setForm({ ...form, area: t })} placeholder="Downtown" /></View>
          </View>
          <View style={styles.formGroup}><FormLabel label="Address" /><Input value={form.address} onChangeText={t => setForm({ ...form, address: t })} placeholder="Apt, Building, Street..." multiline /></View>
          <View style={styles.formGroup}><FormLabel label="Skills (comma-separated)" /><Input value={form.skills} onChangeText={t => setForm({ ...form, skills: t })} placeholder="deep_cleaning, bathroom, kitchen" /></View>
          <View style={styles.formGroup}>
            <FormLabel label="Status" />
            <SelectButton label="Select Status" value={form.status === 'active' ? 'Active' : form.status === 'on_leave' ? 'On Leave' : 'Inactive'} onPress={() => setStatusOptionsVisible(true)} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editId ? 'Update' : 'Create'} onPress={save} loading={saving} />
        </View>
      </SafeAreaView>
      
      {/* Status Picker Modal */}
      <Modal visible={statusOptionsVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Select Status</Text>
            {['active', 'on_leave', 'inactive'].map(s => <Pressable key={s} style={styles.optionRow} onPress={() => { setForm({ ...form, status: s }); setStatusOptionsVisible(false); }}>
              <Text style={styles.optionText}>{s === 'active' ? 'Active' : s === 'on_leave' ? 'On Leave' : 'Inactive'}</Text>
            </Pressable>)}
            <Pressable style={styles.optionCancel} onPress={() => setStatusOptionsVisible(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
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
  list: { padding: 20, paddingTop: 10, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#047857' },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: palette.muted, fontFamily: 'Courier New' },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  badgeText: { fontSize: 10, fontWeight: '700', color: palette.muted, textTransform: 'capitalize' },
  skillsBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  skillPill: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  skillText: { fontSize: 10, color: '#065f46', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  stats: { flexDirection: 'row', gap: 6 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: palette.surfaceMuted },
  statText: { fontSize: 11, fontWeight: '600', color: palette.ink },
  salary: { fontSize: 14, fontWeight: '800', color: palette.primary, marginRight: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 19, fontWeight: '700', color: palette.ink },
  closeBtn: { padding: 4 },
  formBody: { padding: 20, gap: 20 },
  formGroup: {},
  row: { flexDirection: 'row', gap: 14 },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  optionsBox: { backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsTitle: { padding: 20, fontSize: 17, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
