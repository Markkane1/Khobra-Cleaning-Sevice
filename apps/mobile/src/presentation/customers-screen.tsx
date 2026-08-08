import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton } from './mobile-ui'

type Customer = { id: string; user?: { name: string; email: string }; phone: string; address: string; city: string; area: string; status: string; _count?: { bookings: number; complaints: number } }

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', area: '', temporaryPassword: '' }

export function CustomersScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/customers`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(setCustomers)
      .catch(() => Alert.alert('Error', 'Could not load customers.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    if (!form.name || !form.email) return Alert.alert('Validation', 'Please provide at least Name and Email.')
    setSaving(true)
    try {
      const payload = { ...form, addresses: [{ label: 'Primary', address: form.address, city: form.city, area: form.area }] }
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/customers`, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload)
      })
      if (!res.ok) throw new Error('Failed to save customer')
      setFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = (id: string) => {
    Alert.alert('Delete Customer', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${apiBaseUrl}/api/khobra-cleaning/customers?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
          load()
        } catch (e) {
          Alert.alert('Error', 'Failed to delete.')
        }
      }}
    ])
  }

  const openEdit = (c: Customer) => {
    setEditId(c.id)
    setForm({ name: c.user?.name || '', email: c.user?.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', area: c.area || '', temporaryPassword: '' })
    setFormOpen(true)
  }

  const openNew = () => {
    setEditId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const getInitials = (name?: string) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?'

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Customers" subtitle="Manage your customer base" action={<Pressable onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>

    {loading ? <LoadingState label="Loading customers..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={customers}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="people-outline" title="No customers found" detail="Add your first customer to get started." />}
      renderItem={({ item: c }) => <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(c.user?.name)}</Text></View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{c.user?.name}</Text>
            <View style={styles.metaRow}><Ionicons name="call-outline" size={12} color={palette.muted} /><Text style={styles.metaText}>{c.phone || 'No phone'}</Text></View>
            <View style={styles.metaRow}><Ionicons name="location-outline" size={12} color={palette.muted} /><Text style={styles.metaText}>{[c.area, c.city].filter(Boolean).join(', ') || 'No address'}</Text></View>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>{c.status}</Text></View>
        </View>
        
        <View style={styles.actions}>
          <View style={styles.stats}>
            <View style={styles.statPill}><Ionicons name="calendar-outline" size={12} color={palette.primaryDark} /><Text style={styles.statText}>{c._count?.bookings || 0} Bookings</Text></View>
            {c._count?.complaints ? <View style={[styles.statPill, styles.statDanger]}><Ionicons name="warning-outline" size={12} color={palette.danger} /><Text style={[styles.statText, {color: palette.danger}]}>{c._count.complaints} Complaints</Text></View> : null}
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.iconButton} onPress={() => openEdit(c)}><Ionicons name="pencil" size={18} color={palette.primary} /></Pressable>
            <Pressable style={styles.iconButton} onPress={() => remove(c.id)}><Ionicons name="trash" size={18} color={palette.danger} /></Pressable>
          </View>
        </View>
      </View>}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Edit Customer' : 'Add Customer'}</Text>
          <Pressable onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Full Name *" /><Input value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="John Doe" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Email *" /><Input value={form.email} onChangeText={t => setForm({ ...form, email: t })} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
          </View>
          {!editId && <View style={styles.formGroup}><FormLabel label="Temporary Password *" /><Input value={form.temporaryPassword} onChangeText={t => setForm({ ...form, temporaryPassword: t })} placeholder="min 8 chars" secureTextEntry /></View>}
          <View style={styles.formGroup}><FormLabel label="Phone" /><Input value={form.phone} onChangeText={t => setForm({ ...form, phone: t })} placeholder="+971 50..." keyboardType="phone-pad" /></View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="City" /><Input value={form.city} onChangeText={t => setForm({ ...form, city: t })} placeholder="Dubai" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Area" /><Input value={form.area} onChangeText={t => setForm({ ...form, area: t })} placeholder="Downtown" /></View>
          </View>
          <View style={styles.formGroup}><FormLabel label="Primary Address" /><Input value={form.address} onChangeText={t => setForm({ ...form, address: t })} placeholder="Apt, Building, Street..." multiline /></View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editId ? 'Save Changes' : 'Create Customer'} onPress={save} loading={saving} />
        </View>
      </SafeAreaView>
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
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: palette.primaryDark },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: palette.muted },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: palette.border },
  badgeText: { fontSize: 10, fontWeight: '700', color: palette.muted, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  stats: { flexDirection: 'row', gap: 6 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: palette.primarySoft },
  statDanger: { backgroundColor: '#fef2f2' },
  statText: { fontSize: 11, fontWeight: '600', color: palette.primaryDark },
  actionRow: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 19, fontWeight: '700', color: palette.ink },
  closeBtn: { padding: 4 },
  formBody: { padding: 20, gap: 20 },
  formGroup: {},
  row: { flexDirection: 'row', gap: 14 },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
})
