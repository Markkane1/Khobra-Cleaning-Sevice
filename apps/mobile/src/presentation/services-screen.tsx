import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Material = { inventoryItemId: string; quantityPerCleanerHour: string; unit: string }
type Service = { id: string; name: string; description: string; baseRate: number; withMaterialsRate: number; minDuration: number; category: string; skills: string; status: string; materials?: Material[]; galleryImages?: string[]; heroImages?: string[] }

const emptyForm = { name: '', description: '', baseRate: '150', withMaterialsRate: '180', minDuration: '2', category: 'Cleaning', skills: '', materials: [] as Material[] }

export function ServicesScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    request<Service[]>('/api/khobra-cleaning/services', {}, session.token)
      .then(setServices)
      .catch(() => Alert.alert('Error', 'Could not load services.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    if (!form.name || !form.baseRate || !form.withMaterialsRate) return Alert.alert('Validation', 'Please fill both service prices.')
    setSaving(true)
    try {
      const payload = { ...form, materials: form.materials.filter(item => item.inventoryItemId && Number(item.quantityPerCleanerHour) > 0).map(item => ({ ...item, quantityPerCleanerHour: Number(item.quantityPerCleanerHour) })), baseRate: Number(form.baseRate), withMaterialsRate: Number(form.withMaterialsRate), minDuration: Number(form.minDuration), galleryImages: [], heroImages: [] }
      await request('/api/khobra-cleaning/services', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload)
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
    Alert.alert('Delete Service', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await request(`/api/khobra-cleaning/services?id=${id}`, { method: 'DELETE' }, session.token)
          load()
        } catch (e) {
          Alert.alert('Error', 'Failed to delete.')
        }
      }}
    ])
  }

  const openEdit = (s: Service) => {
    setEditId(s.id)
    setForm({ name: s.name, description: s.description || '', baseRate: String(s.baseRate), withMaterialsRate: String(s.withMaterialsRate), minDuration: String(s.minDuration), category: s.category || 'Cleaning', skills: s.skills || '', materials: s.materials || [] })
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
      <PageHeading title="Services" subtitle="Manage your service catalog" action={<Pressable accessibilityRole="button" accessibilityLabel="Add service" onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
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
          <View style={styles.priceBox}><Text style={styles.price}>AED {s.baseRate}<Text style={styles.priceUnit}>/hr without</Text></Text><Text style={styles.price}>AED {s.withMaterialsRate}<Text style={styles.priceUnit}>/hr with materials</Text></Text></View>
        </View>
        {s.description ? <Text style={styles.description} numberOfLines={2}>{s.description}</Text> : null}
        <View style={styles.actions}>
          <Text style={styles.meta}>Min {s.minDuration} hrs</Text>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${s.name}`} style={styles.iconButton} onPress={() => openEdit(s)}><Ionicons name="pencil" size={18} color={palette.primary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${s.name}`} style={styles.iconButton} onPress={() => remove(s.id)}><Ionicons name="trash" size={18} color={palette.danger} /></Pressable>
          </View>
        </View>
      </View>}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editId ? 'Edit Service' : 'Add Service'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close service form" onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}><FormLabel label="Service Name *" /><Input value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="e.g. Deep Cleaning" /></View>
          <View style={styles.formGroup}><FormLabel label="Description" /><Input value={form.description} onChangeText={t => setForm({ ...form, description: t })} placeholder="Service scope and details..." multiline /></View>
          <View style={styles.formGroup}><FormLabel label="Without Materials (AED/hr) *" /><Input value={form.baseRate} onChangeText={t => setForm({ ...form, baseRate: t })} keyboardType="numeric" /></View>
          <View style={styles.formGroup}><FormLabel label="With Materials (AED/hr) *" /><Input value={form.withMaterialsRate} onChangeText={t => setForm({ ...form, withMaterialsRate: t })} keyboardType="numeric" /></View>
          <View style={styles.formGroup}><FormLabel label="Min Duration (hrs) *" /><Input value={form.minDuration} onChangeText={t => setForm({ ...form, minDuration: t })} keyboardType="numeric" /></View>
          <View style={styles.formGroup}><FormLabel label="Category *" /><Input value={form.category} onChangeText={t => setForm({ ...form, category: t })} placeholder="e.g. Cleaning, Specialized" /></View>
          <View style={styles.formGroup}><FormLabel label="Skill Tags (informational only)" /><Input value={form.skills} onChangeText={t => setForm({ ...form, skills: t })} placeholder="e.g. deep_cleaning, bathroom" /></View>
          <View style={styles.formGroup}><FormLabel label="BOM materials (internal, per cleaner-hour)" />{form.materials.map((item, index) => <View key={index} style={styles.materialRow}><Input value={item.inventoryItemId} onChangeText={value => setForm({ ...form, materials: form.materials.map((current, i) => i === index ? { ...current, inventoryItemId: value } : current) })} placeholder="Inventory item ID" /><Input value={item.quantityPerCleanerHour} onChangeText={value => setForm({ ...form, materials: form.materials.map((current, i) => i === index ? { ...current, quantityPerCleanerHour: value } : current) })} placeholder="Qty" keyboardType="numeric" /><Pressable accessibilityRole="button" accessibilityLabel="Remove material" style={styles.removeMaterial} onPress={() => setForm({ ...form, materials: form.materials.filter((_, i) => i !== index) })}><Ionicons name="trash-outline" size={22} color={palette.danger}/></Pressable></View>)}<Pressable style={styles.addMaterial} onPress={() => setForm({ ...form, materials: [...form.materials, { inventoryItemId: '', quantityPerCleanerHour: '1', unit: 'pcs' }] })}><Text style={styles.addMaterialText}>Add material</Text></Pressable></View>
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
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitleBox: { flex: 1, paddingRight: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: palette.ink, marginBottom: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: palette.primaryDark },
  priceBox: { flexShrink: 1, minWidth: 130, alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: '800', color: palette.primary, textAlign: 'right' },
  priceUnit: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  description: { fontSize: 14, color: palette.muted, lineHeight: 20, marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  meta: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  materialRow: { gap: 8, marginTop: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 10 }, removeMaterial: { width: 44, height: 44, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: palette.surfaceMuted }, addMaterial: { minHeight: 44, justifyContent: 'center', marginTop: 8 }, addMaterialText: { color: palette.primaryDark, fontWeight: '700' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formBody: { padding: 20, gap: 20 },
  formGroup: {},
  row: { gap: 14 },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
})
