import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Item = { id: string; name: string; sku: string; category: string; unit: string; currentStock: number; minStock: number; costPrice: number; sellPrice: number }
type Vendor = { id: string; name: string; contactPerson: string; phone: string; email: string; address: string }

const emptyItemForm = { name: '', sku: '', category: '', unit: 'pcs', currentStock: '0', minStock: '0', costPrice: '0', sellPrice: '0' }
const emptyVendorForm = { name: '', contactPerson: '', phone: '', email: '', address: '' }

export function InventoryScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [tab, setTab] = useState<'items'|'vendors'>('items')
  
  const [items, setItems] = useState<Item[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  
  const [vendorFormOpen, setVendorFormOpen] = useState(false)
  const [editVendorId, setEditVendorId] = useState<string | null>(null)
  const [vendorForm, setVendorForm] = useState(emptyVendorForm)

  const [saving, setSaving] = useState(false)
  const [categoryOptionsVisible, setCategoryOptionsVisible] = useState(false)
  const [unitOptionsVisible, setUnitOptionsVisible] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      fetch(`${apiBaseUrl}/api/khobra-cleaning/inventory`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
      fetch(`${apiBaseUrl}/api/khobra-cleaning/vendors`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json())
    ]).then(([resItems, resVendors]) => {
      setItems(resItems)
      setVendors(resVendors)
    }).catch(() => Alert.alert('Error', 'Could not load inventory data.'))
    .finally(() => setLoading(false))
  }

  useEffect(loadData, [session.token])

  const saveItem = async () => {
    if (!itemForm.name) return Alert.alert('Validation', 'Please provide Name.')
    setSaving(true)
    try {
      const payload = { ...itemForm, currentStock: Number(itemForm.currentStock), minStock: Number(itemForm.minStock), costPrice: Number(itemForm.costPrice), sellPrice: Number(itemForm.sellPrice) }
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/inventory`, {
        method: editItemId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(editItemId ? { id: editItemId, ...payload } : payload)
      })
      if (!res.ok) throw new Error('Failed to save item')
      setItemFormOpen(false)
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const saveVendor = async () => {
    if (!vendorForm.name) return Alert.alert('Validation', 'Please provide Company Name.')
    setSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/vendors`, {
        method: editVendorId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(editVendorId ? { id: editVendorId, ...vendorForm } : vendorForm)
      })
      if (!res.ok) throw new Error('Failed to save vendor')
      setVendorFormOpen(false)
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const removeItem = (id: string) => {
    Alert.alert('Delete Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${apiBaseUrl}/api/khobra-cleaning/inventory?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
          loadData()
        } catch (e) { Alert.alert('Error', 'Failed to delete.') }
      }}
    ])
  }

  const removeVendor = (id: string) => {
    Alert.alert('Delete Vendor', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${apiBaseUrl}/api/khobra-cleaning/vendors?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } })
          loadData()
        } catch (e) { Alert.alert('Error', 'Failed to delete.') }
      }}
    ])
  }

  const openNew = () => {
    if (tab === 'items') { setEditItemId(null); setItemForm(emptyItemForm); setItemFormOpen(true) }
    else { setEditVendorId(null); setVendorForm(emptyVendorForm); setVendorFormOpen(true) }
  }

  const renderItemCard = ({ item: i }: { item: Item }) => {
    const isLow = i.currentStock <= i.minStock
    return <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{i.name}</Text>
          <Text style={styles.metaText}>SKU: {i.sku || 'N/A'} • {i.category}</Text>
        </View>
        <View style={styles.actionsBox}>
          <Pressable style={styles.iconButton} onPress={() => { setEditItemId(i.id); setItemForm({ name: i.name, sku: i.sku || '', category: i.category || '', unit: i.unit, currentStock: String(i.currentStock), minStock: String(i.minStock), costPrice: String(i.costPrice), sellPrice: String(i.sellPrice) }); setItemFormOpen(true) }}><Ionicons name="pencil" size={16} color={palette.primary} /></Pressable>
          <Pressable style={styles.iconButton} onPress={() => removeItem(i.id)}><Ionicons name="trash" size={16} color={palette.danger} /></Pressable>
        </View>
      </View>
      <View style={styles.stockRow}>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6}}>
            <Text style={[styles.stockText, isLow && {color: palette.danger}]}>{i.currentStock} {i.unit}</Text>
            <Text style={styles.minText}>Min: {i.minStock}</Text>
          </View>
          <View style={styles.stockBar}><View style={[styles.stockFill, isLow ? {backgroundColor: palette.danger, width: '15%'} : {width: '60%'}]} /></View>
        </View>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceMeta}>Cost: AED {i.costPrice}</Text>
        <Text style={styles.priceMeta}>Sell: AED {i.sellPrice}</Text>
      </View>
    </View>
  }

  const renderVendorCard = ({ item: v }: { item: Vendor }) => {
    return <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{v.name}</Text>
          <Text style={styles.metaText}>{v.contactPerson}</Text>
        </View>
        <View style={styles.actionsBox}>
          <Pressable style={styles.iconButton} onPress={() => { setEditVendorId(v.id); setVendorForm({ name: v.name, contactPerson: v.contactPerson || '', phone: v.phone || '', email: v.email || '', address: v.address || '' }); setVendorFormOpen(true) }}><Ionicons name="pencil" size={16} color={palette.primary} /></Pressable>
          <Pressable style={styles.iconButton} onPress={() => removeVendor(v.id)}><Ionicons name="trash" size={16} color={palette.danger} /></Pressable>
        </View>
      </View>
      <View style={styles.vendorDetails}>
        {v.phone ? <Text style={styles.metaText}><Ionicons name="call" size={12} /> {v.phone}</Text> : null}
        {v.email ? <Text style={styles.metaText}><Ionicons name="mail" size={12} /> {v.email}</Text> : null}
        {v.address ? <Text style={styles.metaText}><Ionicons name="location" size={12} /> {v.address}</Text> : null}
      </View>
    </View>
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Inventory" subtitle="Stock management and vendor relations" action={<Pressable onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
      
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'items' && styles.tabActive]} onPress={() => setTab('items')}><Text style={[styles.tabText, tab === 'items' && styles.tabTextActive]}>Items ({items.length})</Text></Pressable>
        <Pressable style={[styles.tab, tab === 'vendors' && styles.tabActive]} onPress={() => setTab('vendors')}><Text style={[styles.tabText, tab === 'vendors' && styles.tabTextActive]}>Vendors ({vendors.length})</Text></Pressable>
      </View>
    </View>

    {loading ? <LoadingState label="Loading data..." /> : tab === 'items' ? <FlatList
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="cube-outline" title="No items found" detail="Add your first item." />}
      renderItem={renderItemCard}
    /> : <FlatList
      contentContainerStyle={styles.list}
      data={vendors}
      keyExtractor={vendor => vendor.id}
      ListEmptyComponent={<MessageState icon="people-outline" title="No vendors found" detail="Add your first vendor." />}
      renderItem={renderVendorCard}
    />}

    <Modal visible={itemFormOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editItemId ? 'Edit Item' : 'Add Item'}</Text>
          <Pressable onPress={() => setItemFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}><FormLabel label="Item Name *" /><Input value={itemForm.name} onChangeText={t => setItemForm({ ...itemForm, name: t })} placeholder="e.g. Glass Cleaner" /></View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="SKU" /><Input value={itemForm.sku} onChangeText={t => setItemForm({ ...itemForm, sku: t })} placeholder="SKU-123" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Category" /><SelectButton label="Category" value={itemForm.category} onPress={() => setCategoryOptionsVisible(true)} /></View>
          </View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Unit" /><SelectButton label="Unit" value={itemForm.unit} onPress={() => setUnitOptionsVisible(true)} /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Min Stock" /><Input value={itemForm.minStock} onChangeText={t => setItemForm({ ...itemForm, minStock: t })} keyboardType="numeric" /></View>
          </View>
          <View style={styles.formGroup}><FormLabel label="Current Stock" /><Input value={itemForm.currentStock} onChangeText={t => setItemForm({ ...itemForm, currentStock: t })} keyboardType="numeric" /></View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Cost Price" /><Input value={itemForm.costPrice} onChangeText={t => setItemForm({ ...itemForm, costPrice: t })} keyboardType="numeric" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Sell Price" /><Input value={itemForm.sellPrice} onChangeText={t => setItemForm({ ...itemForm, sellPrice: t })} keyboardType="numeric" /></View>
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editItemId ? 'Update' : 'Add'} onPress={saveItem} loading={saving} />
        </View>
      </SafeAreaView>
      
      {/* Category Picker Modal */}
      <Modal visible={categoryOptionsVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Select Category</Text>
            {['Chemicals', 'Tools', 'Supplies', 'PPE'].map(s => <Pressable key={s} style={styles.optionRow} onPress={() => { setItemForm({ ...itemForm, category: s }); setCategoryOptionsVisible(false); }}>
              <Text style={styles.optionText}>{s}</Text>
            </Pressable>)}
            <Pressable style={styles.optionCancel} onPress={() => setCategoryOptionsVisible(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal visible={unitOptionsVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Select Unit</Text>
            {['pcs', 'litre', 'pack', 'pair', 'can', 'kg'].map(s => <Pressable key={s} style={styles.optionRow} onPress={() => { setItemForm({ ...itemForm, unit: s }); setUnitOptionsVisible(false); }}>
              <Text style={styles.optionText}>{s}</Text>
            </Pressable>)}
            <Pressable style={styles.optionCancel} onPress={() => setUnitOptionsVisible(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Modal>

    <Modal visible={vendorFormOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editVendorId ? 'Edit Vendor' : 'Add Vendor'}</Text>
          <Pressable onPress={() => setVendorFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}><FormLabel label="Company Name *" /><Input value={vendorForm.name} onChangeText={t => setVendorForm({ ...vendorForm, name: t })} placeholder="Vendor Co." /></View>
          <View style={styles.formGroup}><FormLabel label="Contact Person" /><Input value={vendorForm.contactPerson} onChangeText={t => setVendorForm({ ...vendorForm, contactPerson: t })} placeholder="John Doe" /></View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Phone" /><Input value={vendorForm.phone} onChangeText={t => setVendorForm({ ...vendorForm, phone: t })} keyboardType="phone-pad" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Email" /><Input value={vendorForm.email} onChangeText={t => setVendorForm({ ...vendorForm, email: t })} keyboardType="email-address" autoCapitalize="none" /></View>
          </View>
          <View style={styles.formGroup}><FormLabel label="Address" /><Input value={vendorForm.address} onChangeText={t => setVendorForm({ ...vendorForm, address: t })} placeholder="Street, City..." multiline /></View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={editVendorId ? 'Update' : 'Add'} onPress={saveVendor} loading={saving} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 0 },
  backButton: { marginBottom: 10 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tabs: { flexDirection: 'row', marginTop: 10, backgroundColor: palette.surfaceMuted, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: palette.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: palette.muted },
  tabTextActive: { color: palette.ink },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardInfo: { flex: 1, paddingRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 4 },
  metaText: { fontSize: 12, color: palette.muted },
  actionsBox: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stockRow: { marginBottom: 12 },
  stockText: { fontSize: 13, fontWeight: '700', color: palette.ink },
  minText: { fontSize: 11, color: palette.muted },
  stockBar: { height: 6, backgroundColor: palette.surfaceMuted, borderRadius: 3, overflow: 'hidden' },
  stockFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 3 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
  priceMeta: { fontSize: 12, fontWeight: '600', color: palette.muted },
  vendorDetails: { gap: 6, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 19, fontWeight: '700', color: palette.ink },
  closeBtn: { padding: 4 },
  formBody: { padding: 20, gap: 16 },
  formGroup: {},
  row: { flexDirection: 'row', gap: 14 },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 20 },
  optionsBox: { backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsTitle: { padding: 20, fontSize: 17, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
