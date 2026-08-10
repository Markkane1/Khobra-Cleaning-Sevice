import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, PageHeading, palette } from './mobile-ui'

type Report = {
  currency: string
  period: { days: number }
  summary: { revenue: number; expenses: number; netCashFlow: number; bookedValue: number; bookings: number; completed: number; cancelled: number; noShow: number; completionRate: number; uniqueCustomers: number; repeatCustomers: number; collectionRate: number; outstanding: number; changes: Record<string, number | null> }
  services: Array<{ name: string; bookings: number; bookedValue: number; completionRate: number }>
  statuses: Array<{ name: string; value: number }>
  expenseCategories: Array<{ name: string; value: number }>
  staff: Array<{ name: string; assignments: number; completed: number; completionRate: number; averageRating: number | null }>
  weekdays: Array<{ name: string; value: number }>
  serviceQuality: { complaints: number; complaintResolutionRate: number; averageResolutionHours: number }
}

const date = (value: Date) => value.toISOString().slice(0, 10)
const money = (currency: string, value: number) => `${currency} ${Math.round(value || 0).toLocaleString()}`
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export function ReportsScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [days, setDays] = useState(30)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    const to = new Date()
    const from = new Date(); from.setUTCDate(from.getUTCDate() - days + 1)
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/reports?from=${date(from)}&to=${date(to)}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load reports.')
        setReport(body)
      })
      .catch(error => Alert.alert('Reports unavailable', error.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [days, session.token])

  const insights = useMemo(() => {
    if (!report) return []
    const s = report.summary
    return [
      `${s.completed} of ${s.bookings} bookings were completed (${s.completionRate}%).`,
      `${money(report.currency, s.outstanding)} remains outstanding with a ${s.collectionRate}% invoice collection rate.`,
      report.services[0] ? `${report.services[0].name} led demand with ${report.services[0].bookings} bookings.` : 'No service demand was recorded.',
      report.weekdays[0] ? `${report.weekdays[0].name} was the busiest day for staffing.` : 'No peak day is available yet.',
    ]
  }, [report])

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back to Admin Hub" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Reports & Analytics" subtitle="Financial, operational, customer, and staff insights" />
      <View style={styles.filters}>{[7, 30, 90].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: days === value }} onPress={() => setDays(value)} style={({ pressed }) => [styles.filter, days === value && styles.filterActive, pressed && styles.pressed]}><Text style={[styles.filterText, days === value && styles.filterTextActive]}>{value} days</Text></Pressable>)}</View>
    </View>

    {loading || !report ? <LoadingState label="Building detailed report..." /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.kpiGrid}>
        {[
          ['cash-outline', 'Cash Collected', money(report.currency, report.summary.revenue), report.summary.changes.revenue],
          ['trending-down-outline', 'Total Outflow', money(report.currency, report.summary.expenses), report.summary.changes.expenses],
          ['wallet-outline', 'Net Cash Flow', money(report.currency, report.summary.netCashFlow), report.summary.changes.netCashFlow],
          ['briefcase-outline', 'Bookings', String(report.summary.bookings), report.summary.changes.bookings],
        ].map(([icon, name, value, change]) => <View key={name as string} style={styles.kpiBox}><Ionicons name={icon as any} size={22} color={palette.primaryDark} /><Text style={styles.kpiLabel}>{name as string}</Text><Text style={styles.kpiValue}>{value as string}</Text><Text style={[styles.change, Number(change) < 0 && styles.negative]}>{change === null ? 'New period' : `${Number(change) >= 0 ? '+' : ''}${change}% vs previous`}</Text></View>)}
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Decision Support</Text><View style={styles.card}>{insights.map((item, index) => <View key={item} style={[styles.insight, index > 0 && styles.rowBorder]}><Ionicons name="sparkles-outline" size={18} color={palette.primaryDark} /><Text style={styles.insightText}>{item}</Text></View>)}</View></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Financial Health</Text><View style={styles.card}>{[
        ['Booked Value', money(report.currency, report.summary.bookedValue)],
        ['Outstanding', money(report.currency, report.summary.outstanding)],
        ['Collection Rate', `${report.summary.collectionRate}%`],
        ['Unique Customers', String(report.summary.uniqueCustomers)],
        ['Repeat Customers', String(report.summary.repeatCustomers)],
        ['Cancelled / No-show', `${report.summary.cancelled} / ${report.summary.noShow}`],
        ['Complaints / Resolution', `${report.serviceQuality.complaints} / ${report.serviceQuality.complaintResolutionRate}%`],
        ['Average Resolution Time', `${report.serviceQuality.averageResolutionHours} hours`],
      ].map(([name, value], index) => <View key={name} style={[styles.row, index > 0 && styles.rowBorder]}><Text style={styles.rowLabel}>{name}</Text><Text style={styles.rowValue}>{value}</Text></View>)}</View></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Booking Status</Text><BarList data={report.statuses.map(item => ({ ...item, name: label(item.name) }))} /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Top Services</Text><BarList data={report.services.map(item => ({ name: item.name, value: item.bookings, detail: `${money(report.currency, item.bookedValue)} · ${item.completionRate}% complete` }))} /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Expense Categories</Text><BarList data={report.expenseCategories.map(item => ({ name: item.name, value: item.value, detail: money(report.currency, item.value) }))} /></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Cleaner Performance</Text><View style={styles.card}>{report.staff.length ? report.staff.map((item, index) => <View key={item.name} style={[styles.staffRow, index > 0 && styles.rowBorder]}><View style={styles.staffText}><Text style={styles.staffName}>{item.name}</Text><Text style={styles.staffDetail}>{item.completed}/{item.assignments} completed · {item.averageRating ? `${item.averageRating.toFixed(1)} / 5` : 'No ratings'}</Text></View><Text style={styles.staffRate}>{item.completionRate}%</Text></View>) : <Text style={styles.empty}>No cleaner assignments in this period.</Text>}</View></View>
    </ScrollView>}
  </View>
}

function BarList({ data }: { data: Array<{ name: string; value: number; detail?: string }> }) {
  const max = Math.max(...data.map(item => item.value), 1)
  return <View style={styles.card}>{data.length ? data.slice(0, 8).map((item, index) => <View key={item.name} style={[styles.barItem, index > 0 && styles.rowBorder]}><View style={styles.barHeader}><Text style={styles.barName}>{item.name}</Text><Text style={styles.barValue}>{item.detail || item.value.toLocaleString()}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(3, (item.value / max) * 100)}%` }]} /></View></View>) : <Text style={styles.empty}>No data in this period.</Text>}</View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { width: 44, height: 44, justifyContent: 'center', marginBottom: 6 },
  pressed: { opacity: 0.7 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 16 },
  filter: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface },
  filterActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  filterText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: palette.primaryDark },
  content: { padding: 20, gap: 24, paddingBottom: 120 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiBox: { width: '48%', minHeight: 130, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, ...cardShadow },
  kpiLabel: { color: palette.muted, fontSize: 12, marginTop: 10, fontWeight: '600' },
  kpiValue: { color: palette.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  change: { color: palette.primaryDark, fontSize: 10, fontWeight: '600', marginTop: 5 },
  negative: { color: palette.danger },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: palette.ink },
  card: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', ...cardShadow },
  insight: { minHeight: 58, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  insightText: { flex: 1, color: palette.ink, fontSize: 13, lineHeight: 20 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: palette.border },
  rowLabel: { fontSize: 13, color: palette.muted, fontWeight: '600' },
  rowValue: { fontSize: 14, color: palette.ink, fontWeight: '800' },
  barItem: { padding: 14, gap: 8 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  barName: { flex: 1, fontSize: 13, color: palette.ink, fontWeight: '700' },
  barValue: { fontSize: 11, color: palette.muted, fontWeight: '600', textAlign: 'right' },
  track: { height: 9, borderRadius: 5, backgroundColor: palette.primarySoft, overflow: 'hidden' },
  fill: { height: 9, borderRadius: 5, backgroundColor: palette.primary },
  staffRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: 14 },
  staffText: { flex: 1, gap: 3 },
  staffName: { fontSize: 14, color: palette.ink, fontWeight: '700' },
  staffDetail: { fontSize: 11, color: palette.muted },
  staffRate: { fontSize: 16, color: palette.primaryDark, fontWeight: '800' },
  empty: { padding: 20, textAlign: 'center', color: palette.muted, fontSize: 13 },
})
