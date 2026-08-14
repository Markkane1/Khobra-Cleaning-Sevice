import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

type PayrollRecord = { id: string; employeeCode: string; name: string; email: string; baseSalary: number; deductions: number; overtimePay: number; netSalary: number; payrollStatus: string }
type PayrollSummary = { totalGross: number; totalNet: number; totalDeductions: number; totalOvertime: number; month: string; employeeCount: number }

export function PayrollScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    request<{ records: PayrollRecord[]; summary: PayrollSummary }>('/api/khobra-cleaning/payroll', {}, session.token)
      .then(d => { setRecords(d.records || []); setSummary(d.summary || null); })
      .catch(() => Alert.alert('Error', 'Could not load payroll.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const approve = async (rec: PayrollRecord) => {
    try {
      await request('/api/khobra-cleaning/payroll', {
        method: 'PUT',
        body: JSON.stringify({ employeeId: rec.id, status: 'approved', baseSalary: rec.baseSalary, deductions: rec.deductions, allowances: rec.overtimePay, netSalary: rec.netSalary })
      }, session.token)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  const approveAll = () => {
    const pending = records.filter(r => r.payrollStatus === 'pending')
    if (pending.length === 0) return Alert.alert('Notice', 'No pending records to approve.')
    Alert.alert('Approve All', `Are you sure you want to approve ${pending.length} records?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => {
        Promise.all(pending.map(approve)).then(load)
      }}
    ])
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Payroll" subtitle={summary?.month ? `Processing for ${summary.month}` : 'Employee salary management'} action={<Pressable accessibilityRole="button" accessibilityLabel="Approve all pending payroll" onPress={approveAll} style={styles.approveAllBtn}><Ionicons name="checkmark-done" size={24} color="#fff" /></Pressable>} />
    </View>

    {summary && <View style={styles.summaryRow}>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Total Net Pay</Text>
        <Text style={styles.summaryVal}>AED {summary.totalNet.toLocaleString()}</Text>
      </View>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Deductions</Text>
        <Text style={[styles.summaryVal, { color: palette.danger }]}>AED {summary.totalDeductions.toLocaleString()}</Text>
      </View>
    </View>}

    {loading ? <LoadingState label="Loading payroll..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={records}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="cash-outline" title="No Payroll Data" detail="No employee records found for this period." />}
      renderItem={({ item: r }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.empName}>{r.name} <Text style={styles.empCode}>({r.employeeCode})</Text></Text>
              <Text style={styles.empEmail}>{r.email}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: r.payrollStatus === 'approved' ? '#d1fae5' : '#fef3c7' }]}>
              <Text style={[styles.badgeText, { color: r.payrollStatus === 'approved' ? '#047857' : '#b45309' }]}>{r.payrollStatus}</Text>
            </View>
          </View>
          <View style={styles.salaryGrid}>
            <View style={styles.salItem}><Text style={styles.salLabel}>Base Salary</Text><Text style={styles.salVal}>AED {r.baseSalary}</Text></View>
            <View style={styles.salItem}><Text style={styles.salLabel}>Overtime</Text><Text style={[styles.salVal, { color: '#0d9488' }]}>+{r.overtimePay}</Text></View>
            <View style={styles.salItem}><Text style={styles.salLabel}>Deductions</Text><Text style={[styles.salVal, { color: palette.danger }]}>-{r.deductions}</Text></View>
            <View style={styles.salItem}><Text style={styles.salLabel}>Net Salary</Text><Text style={[styles.salVal, { color: palette.primaryDark, fontWeight: '800' }]}>AED {r.netSalary}</Text></View>
          </View>
          {r.payrollStatus === 'pending' && <Pressable style={styles.approveBtn} onPress={() => approve(r)}>
            <Text style={styles.approveBtnText}>Approve Net Salary</Text>
          </Pressable>}
        </View>
      )}
    />}
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  approveAllBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 10 },
  summaryBox: { flex: 1, backgroundColor: palette.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  summaryLabel: { fontSize: 12, color: palette.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal: { fontSize: 18, color: palette.ink, fontWeight: '800', marginTop: 4 },
  
  list: { padding: 20, gap: 14, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardHeaderInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  empName: { fontSize: 16, fontWeight: '700', color: palette.ink },
  empCode: { fontSize: 14, color: palette.muted, fontWeight: '400' },
  empEmail: { fontSize: 12, color: palette.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  
  salaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
  salItem: { width: '47%' },
  salLabel: { fontSize: 12, color: palette.muted, marginBottom: 2 },
  salVal: { fontSize: 14, fontWeight: '600', color: palette.ink },
  
  approveBtn: { minHeight: 44, justifyContent: 'center', backgroundColor: palette.primarySoft, paddingHorizontal: 12, borderRadius: 10, marginTop: 14, alignItems: 'center' },
  approveBtnText: { color: palette.primaryDark, fontWeight: '700', fontSize: 14 },
})
