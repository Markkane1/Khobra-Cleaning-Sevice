import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type BankAccount = { id: string; accountTitle: string; bankName: string; accountNumber: string; iban: string; branchName: string; branchCode: string; currency: string; isActive: boolean; isDefault: boolean; displayOrder: number }

export function BankAccountsScreen({ session, onBack, embedded = false }: { session: Session; onBack?: () => void; embedded?: boolean }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState<Partial<BankAccount>>({})

  const [pickerOpen, setPickerOpen] = useState(false)

  const load = () => {
    setLoading(true)
    request<{ accounts: BankAccount[] }>('/api/khobra-cleaning/company-bank-accounts', {}, session.token)
      .then(d => setAccounts(d.accounts || []))
      .catch(() => Alert.alert('Error', 'Could not load bank accounts.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const openNew = () => {
    setForm({ currency: 'AED', isActive: true, isDefault: false, displayOrder: accounts.length + 1 })
    setFormOpen(true)
  }

  const openEdit = (a: BankAccount) => {
    setForm(a)
    setFormOpen(true)
  }

  const save = async () => {
    if (!form.accountTitle || !form.bankName || !form.accountNumber) return Alert.alert('Validation', 'Account Title, Bank Name, and Account # are required.')
    setSaving(true)
    try {
      await request('/api/khobra-cleaning/company-bank-accounts', {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(form)
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
    Alert.alert('Delete', 'Are you sure you want to delete this bank account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await request(`/api/khobra-cleaning/company-bank-accounts?id=${id}`, { method: 'DELETE' }, session.token)
          load()
        } catch (error) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Could not delete bank account.')
        }
      }}
    ])
  }

  return <View style={styles.screen}>
    {!embedded && <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Bank Accounts" subtitle="Corporate bank accounts" action={<Pressable accessibilityRole="button" accessibilityLabel="Add bank account" onPress={openNew} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    </View>}

    {embedded && <View style={styles.embeddedActions}>
      <Text style={styles.embeddedTitle}>Company Bank Accounts</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Add bank account" onPress={openNew} style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}><Ionicons name="add" size={24} color="#fff" /></Pressable>
    </View>}

    {loading ? <LoadingState label="Loading accounts..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={accounts}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="business-outline" title="No Bank Accounts" detail="Add accounts to receive customer transfers." />}
      renderItem={({ item: a }) => (
        <Pressable style={styles.card} onPress={() => openEdit(a)}>
          <View style={styles.iconBox}><Ionicons name="business-outline" size={24} color={palette.primaryDark} /></View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{a.accountTitle}</Text>
              {a.isDefault && <View style={styles.defBadge}><Text style={styles.defBadgeText}>DEFAULT</Text></View>}
            </View>
            <Text style={styles.detail}>{a.bankName} • {a.currency}</Text>
            <Text style={styles.detail} numberOfLines={1}><Ionicons name="card-outline" /> {a.accountNumber} {a.iban ? `(IBAN: ${a.iban})` : ''}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${a.bankName} account`} style={styles.delBtn} onPress={() => remove(a.id)}><Ionicons name="trash-outline" size={18} color={palette.danger} /></Pressable>
        </Pressable>
      )}
    />}

    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{form.id ? 'Edit Account' : 'New Account'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close bank account form" onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}>
            <FormLabel label="Account Title *" />
            <Input value={form.accountTitle} onChangeText={t => setForm({ ...form, accountTitle: t })} placeholder="Khobra LLC" />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Bank Name *" />
            <Input value={form.bankName} onChangeText={t => setForm({ ...form, bankName: t })} placeholder="Emirates NBD" />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Account Number *" />
            <Input value={form.accountNumber} onChangeText={t => setForm({ ...form, accountNumber: t })} placeholder="123456789" />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="IBAN" />
            <Input value={form.iban} onChangeText={t => setForm({ ...form, iban: t })} placeholder="AE..." />
          </View>
          <View style={styles.formGroup}>
            <FormLabel label="Currency" />
            <Input value={form.currency} onChangeText={t => setForm({ ...form, currency: t.toUpperCase() })} placeholder="AED" />
          </View>
          
          <View style={styles.formGroup}>
            <FormLabel label="Settings" />
            <Pressable style={styles.toggleRow} onPress={() => setForm({ ...form, isActive: !form.isActive })}>
              <Text style={styles.toggleLabel}>Active (Visible to customers)</Text>
              <Ionicons name={form.isActive ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={form.isActive ? palette.primary : palette.muted} />
            </Pressable>
            <Pressable style={styles.toggleRow} onPress={() => setForm({ ...form, isDefault: !form.isDefault })}>
              <Text style={styles.toggleLabel}>Default Account</Text>
              <Ionicons name={form.isDefault ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={form.isDefault ? palette.primary : palette.muted} />
            </Pressable>
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <PrimaryButton label={form.id ? 'Save Changes' : 'Add Bank Account'} onPress={save} loading={saving} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  embeddedActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14 },
  embeddedTitle: { fontSize: 18, fontWeight: '700', color: palette.ink },
  backButton: { marginBottom: 10 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  buttonPressed: { opacity: 0.75 },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow, gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: palette.ink },
  defBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' },
  defBadgeText: { fontSize: 12, fontWeight: '800', color: '#b45309' },
  detail: { fontSize: 14, color: palette.muted },
  delBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  
  modalScreen: { flex: 1, backgroundColor: palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  modalTitle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  formBody: { padding: 20, gap: 16 },
  formGroup: {},
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, marginBottom: 8 },
  toggleLabel: { fontSize: 14, color: palette.ink },
  modalFooter: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
})
