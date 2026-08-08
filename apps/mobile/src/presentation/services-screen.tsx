import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Service = { id: string; name: string; description: string; baseRate: number; minDuration: number; category: string; requiresMaterials: boolean; skills: string; status: string; galleryImages?: string[]; heroImages?: string[] }

const emptyForm = { name: '', description: '', baseRate: '150', minDuration: '2', category: 'Cleaning', skills: '' }

export function ServicesScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/services`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(setServices)
      .catch(() => Alert.alert('Error', 'Could not load services.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    if (!form.name || !form.baseRate) return Alert.alert('Validation', 'Please fill all required fields.')
    setSaving(true)
    try {
      const payload = { ...form, baseRate: Number(form.baseRate), minDuration: Number(form.minDuration), requiresMaterials: false, galleryImages: [], heroImages: [], materials: [] }
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/services`, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload)
      })
      if (!res.ok) throw new Error('Failed to save service')
      setFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = (id: string) => {
    Alert.alert('Delete Service', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${apiBaseUrl}/api/khobra-cleaning/services?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
          load()
        } catch (e) {
          Alert.alert('Error', 'Failed to delete.')
        }
      }}
    ])
  }

  const openEdit = (s: Service) => {
    setEditId(s.id)
    setForm({ name: s.name, description: s.description || '', baseRate: String(s.baseRate), minDuration: String(s.minDuration), category: s.category || 'Cleaning', skills: s.skills || '' })
    setFormOpen(true)
  }

  const openNew = () => {
    setEditId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Services" subtitle="Manage your service catalog" action={<Pressable onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>

    {loading ? <LoadingState label="Loading services..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={services}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="sparkles-outline" title="No services found" detail="Add your first service to the catalog." />}
      renderItem={({ item: s }) => <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle}>{s.name}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{s.category}</Text></View>
          </View>
          <Text style={styles.price}>AED {s.baseRate}<Text style={styles.priceUnit}>/hr</Text></Text>
        </View>
        {s.description ? <Text style={styles.description} numberOfLines={2}>{s.description}</Text> : null}
        <View style={styles.actions}>
          <Text style={styles.meta}>Min {s.minDuration} hrs</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.iconButton} onPress={() => openEdit(s)}><Ionicons name="pencil" size={18} color={palette.primary} /></Pressable>
            <Pressable style={styles.iconButton} onPress={() => remove(s.id)}><Ionicons name="trash" size={18} color={palette.danger} /></Pressable>
          </View>
        </View>
      </View>}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Edit Service' : 'Add Service'}</Text>
          <Pressable onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}><FormLabel label="Service Name *" /><Input value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="e.g. Deep Cleaning" /></View>
          <View style={styles.formGroup}><FormLabel label="Description" /><Input value={form.description} onChangeText={t => setForm({ ...form, description: t })} placeholder="Service scope and details..." multiline /></View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Hourly Rate (AED) *" /><Input value={form.baseRate} onChangeText={t => setForm({ ...form, baseRate: t })} keyboardType="numeric" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Min Duration (hrs) *" /><Input value={form.minDuration} onChangeText={t => setForm({ ...form, minDuration: t })} keyboardType="numeric" /></View>
          </View>
          <View style={styles.formGroup}><FormLabel label="Category *" /><Input value={form.category} onChangeText={t => setForm({ ...form, category: t })} placeholder="e.g. Cleaning, Specialized" /></View>
          <View style={styles.formGroup}><FormLabel label="Required Skills (comma-separated)" /><Input value={form.skills} onChangeText={t => setForm({ ...form, skills: t })} placeholder="e.g. deep_cleaning, bathroom" /></View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editId ? 'Save Changes' : 'Create Service'} onPress={save} loading={saving} />
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitleBox: { flex: 1, paddingRight: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: palette.ink, marginBottom: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', color: palette.primaryDark },
  price: { fontSize: 18, fontWeight: '800', color: palette.primary },
  priceUnit: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  description: { fontSize: 13, color: palette.muted, lineHeight: 19, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  meta: { fontSize: 12, color: palette.muted, fontWeight: '600' },
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
