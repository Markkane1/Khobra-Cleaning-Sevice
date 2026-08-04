import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import type { DriverExpense, DriverExpenseCategory } from '../domain/expenses/types'
import { khobraDriverExpenseGateway } from '../infrastructure/http/khobra-gateways'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

const categories: DriverExpenseCategory[] = ['petrol', 'repair', 'maintenance', 'toll', 'parking', 'other']

export function DriverExpensesScreen({ session }: { session: Session }) {
  const [expenses, setExpenses] = useState<DriverExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<DriverExpenseCategory>('petrol')
  const [typeDetail, setTypeDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const load = () => khobraDriverExpenseGateway.getExpenses(session.token).then(setExpenses).catch(error => Alert.alert('Could not load expenses', error instanceof Error ? error.message : 'Try again.')).finally(() => setLoading(false))
  useEffect(() => { void load() }, [session.token])
  const reset = () => { setCategory('petrol'); setTypeDetail(''); setAmount(''); setExpenseDate(new Date().toISOString().slice(0, 10)); setNotes('') }

  if (loading) return <LoadingState label="Loading expenses..." />
  return <>
    <FlatList contentContainerStyle={styles.list} data={expenses} keyExtractor={item => item.id}
      ListHeaderComponent={<PageHeading title="Expenses" subtitle="Submit petrol, repair and other transport costs." action={<Pressable onPress={() => setOpen(true)} style={styles.add}><Ionicons name="add" size={22} color="#fff" /></Pressable>} />}
      ListEmptyComponent={<MessageState icon="receipt-outline" title="No expenses yet" detail="Submitted driver expenses will appear here." />}
      renderItem={({ item }) => <View style={styles.card}><View style={styles.icon}><Ionicons name={item.category === 'petrol' ? 'water-outline' : item.category === 'repair' || item.category === 'maintenance' ? 'construct-outline' : 'receipt-outline'} size={21} color={palette.primary} /></View><View style={styles.body}><Text style={styles.title}>{item.category.replace(/^./, letter => letter.toUpperCase())}{item.typeDetail ? ` · ${item.typeDetail}` : ''}</Text><Text style={styles.meta}>{new Date(item.expenseDate).toLocaleDateString('en-AE')} · {item.currency} {item.amount.toLocaleString()}</Text>{item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}</View><View style={[styles.status, statusTone[item.status]]}><Text style={styles.statusText}>{item.status}</Text></View></View>} />
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>Add Driver Expense</Text><ScrollView contentContainerStyle={styles.form}><Text style={styles.label}>Expense kind</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map(value => <Pressable key={value} onPress={() => setCategory(value)} style={[styles.category, category === value && styles.categoryActive]}><Text style={[styles.categoryText, category === value && styles.categoryTextActive]}>{value.replace(/^./, letter => letter.toUpperCase())}</Text></Pressable>)}</ScrollView><Text style={styles.label}>Type / detail</Text><TextInput value={typeDetail} onChangeText={setTypeDetail} placeholder="Fuel grade, repair type..." style={styles.input} /><Text style={styles.label}>Amount (AED)</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={styles.input} /><Text style={styles.label}>Expense date (YYYY-MM-DD)</Text><TextInput value={expenseDate} onChangeText={setExpenseDate} style={styles.input} /><Text style={styles.label}>Notes</Text><TextInput value={notes} onChangeText={setNotes} multiline maxLength={1000} style={[styles.input, styles.notesInput]} /><View style={styles.actions}><Pressable onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onPress={async () => { setSaving(true); try { await khobraDriverExpenseGateway.createExpense({ category, typeDetail: typeDetail.trim() || undefined, amount: Number(amount), expenseDate, notes: notes.trim() || undefined }, session.token); reset(); setOpen(false); setLoading(true); load(); Alert.alert('Expense submitted', 'Your expense is pending Admin approval.') } catch (error) { Alert.alert('Could not submit expense', error instanceof Error ? error.message : 'Try again.') } finally { setSaving(false) } }} style={[styles.submit, (!Number(amount) || saving) && { opacity: 0.5 }]}><Text style={styles.submitText}>{saving ? 'Submitting...' : 'Submit Expense'}</Text></Pressable></View></ScrollView></View></View></Modal>
  </>
}

const statusTone = StyleSheet.create({ pending: { backgroundColor: '#fef3c7' }, approved: { backgroundColor: '#d1fae5' }, rejected: { backgroundColor: '#fee2e2' } })
const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 20, paddingBottom: 110, gap: 12 }, add: { width: 45, height: 45, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, ...cardShadow }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, gap: 3 }, title: { color: palette.ink, fontWeight: '800', fontSize: 14 }, meta: { color: palette.muted, fontSize: 12 }, notes: { color: palette.inkSoft, fontSize: 11 }, status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: palette.inkSoft, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.5)', justifyContent: 'flex-end' }, modal: { maxHeight: '90%', backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 22 }, modalTitle: { color: palette.ink, fontSize: 21, fontWeight: '800', paddingHorizontal: 22 }, form: { padding: 22, gap: 9, paddingBottom: 36 }, label: { color: palette.ink, fontWeight: '700', fontSize: 13, marginTop: 3 }, categories: { gap: 7 }, category: { borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, categoryActive: { backgroundColor: palette.primary, borderColor: palette.primary }, categoryText: { color: palette.muted, fontSize: 11, fontWeight: '700' }, categoryTextActive: { color: '#fff' }, input: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceMuted, borderRadius: 12, padding: 12, color: palette.ink }, notesInput: { minHeight: 80, textAlignVertical: 'top' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 8 }, cancel: { borderWidth: 1, borderColor: palette.border, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11 }, cancelText: { color: palette.ink, fontWeight: '700' }, submit: { backgroundColor: palette.primary, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11 }, submitText: { color: '#fff', fontWeight: '800' },
})
