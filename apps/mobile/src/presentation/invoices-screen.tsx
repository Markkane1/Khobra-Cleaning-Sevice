import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, MessageState, PageHeading, palette, PrimaryButton, SelectButton } from './mobile-ui'

type Invoice = { id: string; invoiceNo: string; customerId: string; customer?: { user?: { name: string } }; totalAmount: number; paidAmount?: number; status: string; issuedAt: string }
type Payment = { id: string; amount: number; method: string; status: string; master: { transactionNumber: string }; createdAt: string }
type Customer = { id: string; user?: { name: string } }

export function InvoicesScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [payFormOpen, setPayFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Invoice Form
  const [formCustomer, setFormCustomer] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState('issued')

  // Payment Form
  const [payInv, setPayInv] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')

  const [pickerType, setPickerType] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch(`${apiBaseUrl}/api/khobra-cleaning/invoices`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
      fetch(`${apiBaseUrl}/api/khobra-cleaning/payments`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json()),
      fetch(`${apiBaseUrl}/api/khobra-cleaning/customers`, { headers: { Authorization: `Bearer ${session.token}` } }).then(r => r.json())
    ]).then(([resInv, resPay, resCust]) => {
      setInvoices(resInv)
      setPayments(resPay)
      setCustomers(resCust)
    }).catch(() => Alert.alert('Error', 'Could not load finance data.'))
    .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const saveInvoice = async () => {
    if (!formCustomer || !formAmount) return Alert.alert('Validation', 'Please select customer and enter amount.')
    setSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ customerId: formCustomer, totalAmount: Number(formAmount), status: formStatus, notes: '' })
      })
      if (!res.ok) throw new Error('Failed to create invoice')
      setFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const savePayment = async () => {
    if (!payInv || !payAmount) return Alert.alert('Validation', 'Please select invoice and enter amount.')
    setSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ invoiceId: payInv, amount: Number(payAmount), method: payMethod, referenceNo: `MOB-${Date.now()}` })
      })
      if (!res.ok) throw new Error('Failed to record payment')
      setPayFormOpen(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (s: string) => {
    if (s === 'paid' || s === 'verified') return '#10b981'
    if (s === 'overdue' || s === 'rejected') return '#ef4444'
    if (s === 'partially_paid' || s === 'pending') return '#f59e0b'
    if (s === 'draft') return '#9ca3af'
    return '#0d9488'
  }

  const totalRevenue = payments.filter(p => p.status === 'paid' || p.status === 'verified').reduce((s, p) => s + p.amount, 0)
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + (i.totalAmount - (i.paidAmount || 0)), 0)

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Finance" subtitle="Invoices & Payments" action={
        <View style={{flexDirection: 'row', gap: 8}}>
          <Pressable onPress={() => setPayFormOpen(true)} style={[styles.addButton, {backgroundColor: palette.primaryDark}]}><Ionicons name="card-outline" size={24} color="#fff" /></Pressable>
          <Pressable onPress={() => {
            setFormCustomer('')
            setFormAmount('')
            setFormStatus('issued')
            setFormOpen(true)
          }} style={styles.addButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>
        </View>
      } />
    </View>

    {loading ? <LoadingState label="Loading finance records..." /> : <>
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Collected</Text>
          <Text style={styles.kpiVal}>AED {totalRevenue.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
          <Text style={styles.kpiLabel}>Outstanding</Text>
          <Text style={[styles.kpiVal, {color: '#c2410c'}]}>AED {Math.round(outstanding).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'invoices' && styles.activeTab]} onPress={() => setTab('invoices')}><Text style={[styles.tabText, tab === 'invoices' && styles.activeTabText]}>Invoices ({invoices.length})</Text></Pressable>
        <Pressable style={[styles.tab, tab === 'payments' && styles.activeTab]} onPress={() => setTab('payments')}><Text style={[styles.tabText, tab === 'payments' && styles.activeTabText]}>Payments ({payments.length})</Text></Pressable>
      </View>

      <FlatList<any>
        contentContainerStyle={styles.list}
        data={tab === 'invoices' ? invoices : payments}
        keyExtractor={item => item.id}
        ListEmptyComponent={<MessageState icon="receipt-outline" title={`No ${tab}`} detail={`Generate your first ${tab.slice(0,-1)}.`} />}
        renderItem={({ item }) => {
          if (tab === 'invoices') {
            const i = item as Invoice
            const pct = i.totalAmount > 0 ? Math.round(((i.paidAmount || 0) / i.totalAmount) * 100) : 0
            return <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.invoiceNo}>{i.invoiceNo}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(i.status) + '20' }]}><Text style={[styles.badgeText, { color: getStatusColor(i.status) }]}>{i.status.replace('_', ' ')}</Text></View>
              </View>
              <Text style={styles.customerName}>{i.customer?.user?.name || 'Unknown Customer'}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Total</Text>
                <Text style={styles.amountValue}>AED {i.totalAmount.toLocaleString()}</Text>
              </View>
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Paid: AED {(i.paidAmount || 0).toLocaleString()}</Text>
                  <Text style={styles.progressLabel}>{pct}%</Text>
                </View>
                <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#10b981' : '#f59e0b' }]} /></View>
              </View>
            </View>
          } else {
            const p = item as unknown as Payment
            return <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.invoiceNo}>{p.master?.transactionNumber || p.id.slice(-6)}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(p.status) + '20' }]}><Text style={[styles.badgeText, { color: getStatusColor(p.status) }]}>{p.status.replace('_', ' ')}</Text></View>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount Collected ({p.method.replace('_', ' ')})</Text>
                <Text style={styles.amountValue}>AED {p.amount.toLocaleString()}</Text>
              </View>
              <Text style={[styles.progressLabel, {marginTop: 6}]}>{new Date(p.createdAt).toLocaleString()}</Text>
            </View>
          }
        }}
      />
    </>}

    {/* Create Invoice Modal */}
    <Modal visible={formOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Invoice</Text>
          <Pressable onPress={() => setFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}>
            <FormLabel label="Customer *" />
            <SelectButton label="Select Customer" value={customers.find(c => c.id === formCustomer)?.user?.name || ''} onPress={() => setPickerType('customer')} />
          </View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Total Amount (AED) *" /><Input value={formAmount} onChangeText={setFormAmount} keyboardType="numeric" placeholder="0.00" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Status" /><SelectButton label="Status" value={formStatus.replace('_', ' ')} onPress={() => setPickerType('status')} /></View>
          </View>
        </ScrollView>
        <View style={styles.modalFooter}><PrimaryButton label="Generate Invoice" onPress={saveInvoice} loading={saving} /></View>
      </SafeAreaView>
    </Modal>

    {/* Record Payment Modal */}
    <Modal visible={payFormOpen} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Record Payment</Text>
          <Pressable onPress={() => setPayFormOpen(false)} style={styles.closeBtn}><Ionicons name="close" size={24} color={palette.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.formBody}>
          <View style={styles.formGroup}>
            <FormLabel label="Invoice *" />
            <SelectButton label="Select Invoice" value={invoices.find(i => i.id === payInv)?.invoiceNo || ''} onPress={() => setPickerType('pay_inv')} />
          </View>
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Amount Collected (AED) *" /><Input value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" placeholder="0.00" /></View>
            <View style={[styles.formGroup, { flex: 1 }]}><FormLabel label="Method" /><SelectButton label="Method" value={payMethod.replace('_', ' ')} onPress={() => setPickerType('method')} /></View>
          </View>
        </ScrollView>
        <View style={styles.modalFooter}><PrimaryButton label="Record Payment" onPress={savePayment} loading={saving} style={{backgroundColor: palette.primaryDark}} /></View>
      </SafeAreaView>
    </Modal>
    
    {/* Dynamic Picker Modal */}
    <Modal visible={!!pickerType} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Select Option</Text>
          <ScrollView style={{maxHeight: 300}}>
            {pickerType === 'customer' && customers.map(c => <Pressable key={c.id} style={styles.optionRow} onPress={() => { setFormCustomer(c.id); setPickerType(null); }}><Text style={styles.optionText}>{c.user?.name || 'Unknown'}</Text></Pressable>)}
            {pickerType === 'status' && ['issued', 'draft'].map(c => <Pressable key={c} style={styles.optionRow} onPress={() => { setFormStatus(c); setPickerType(null); }}><Text style={styles.optionText}>{c.replace('_', ' ')}</Text></Pressable>)}
            {pickerType === 'pay_inv' && invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').map(i => <Pressable key={i.id} style={styles.optionRow} onPress={() => { setPayInv(i.id); setPickerType(null); }}><Text style={styles.optionText}>{i.invoiceNo} - {i.customer?.user?.name}</Text></Pressable>)}
            {pickerType === 'method' && ['cash', 'bank_transfer'].map(c => <Pressable key={c} style={styles.optionRow} onPress={() => { setPayMethod(c); setPickerType(null); }}><Text style={styles.optionText}>{c.replace('_', ' ')}</Text></Pressable>)}
          </ScrollView>
          <Pressable style={styles.optionCancel} onPress={() => setPickerType(null)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  addButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  
  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  kpiBox: { flex: 1, backgroundColor: palette.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: palette.muted, marginBottom: 4 },
  kpiVal: { fontSize: 18, fontWeight: '800', color: palette.ink },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: palette.surface, borderRadius: 10, borderWidth: 1, borderColor: palette.border },
  activeTab: { backgroundColor: palette.primary, borderColor: palette.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: palette.ink },
  activeTabText: { color: '#fff' },

  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, ...cardShadow, borderWidth: 1, borderColor: palette.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  invoiceNo: { fontSize: 13, fontWeight: '800', fontFamily: 'Courier New', color: palette.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  customerName: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 12 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 },
  amountLabel: { fontSize: 13, color: palette.muted, fontWeight: '600' },
  amountValue: { fontSize: 17, fontWeight: '800', color: palette.ink },
  progressBox: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: palette.muted, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: palette.surfaceMuted, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  
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
