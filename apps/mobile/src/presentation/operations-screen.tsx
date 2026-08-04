import type { ComponentProps } from 'react'
import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { loadOperationRecords } from '../application/operations'
import type { Session } from '../domain/auth/types'
import { operationModules, type OperationModule, type OperationRecord } from '../domain/operations/types'
import { khobraOperationsGateway } from '../infrastructure/http/khobra-gateways'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

export function OperationsScreen({ session }: { session: Session }) {
  const allowedByRole: Record<Session['user']['role'], OperationModule[]> = {
    admin: operationModules.map(item => item.id),
    customer: ['services', 'complaints', 'notifications'],
    cleaner: ['attendance', 'complaints', 'notifications'],
    driver: ['notifications'],
  }
  const visibleModules = operationModules.filter(item => allowedByRole[session.user.role].includes(item.id))
  const [module, setModule] = useState<OperationModule>(visibleModules[0]?.id || 'notifications')
  const [records, setRecords] = useState<OperationRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadOperationRecords(khobraOperationsGateway, module, session.token)
      .then(setRecords)
      .catch((error) => Alert.alert('Could not load data', error instanceof Error ? error.message : 'Try again.'))
      .finally(() => setLoading(false))
  }, [module, session.token])

  const activeLabel = visibleModules.find((item) => item.id === module)?.label || module
  return <View style={styles.screen}>
    <View style={styles.header}>
      <PageHeading title="Operations" subtitle="Live records from across your service business." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modules}>
        {visibleModules.map((item) => {
          const active = module === item.id
          return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => setModule(item.id)} style={[styles.module, active && styles.activeModule]}>
            <Ionicons name={moduleIcons[item.id]} size={16} color={active ? '#fff' : palette.muted} /><Text style={[styles.moduleText, active && styles.activeModuleText]}>{item.label}</Text>
          </Pressable>
        })}
      </ScrollView>
      <View style={styles.resultBar}><Text style={styles.resultTitle}>{activeLabel}</Text><View style={styles.count}><Text style={styles.countText}>{records.length}</Text></View></View>
    </View>
    {loading ? <LoadingState label={`Loading ${activeLabel.toLowerCase()}...`} /> : <FlatList
      contentContainerStyle={styles.list}
      data={records}
      keyExtractor={(record, index) => record.id || `${module}-${index}`}
      ListEmptyComponent={<MessageState icon={moduleIcons[module]} title={`No ${activeLabel.toLowerCase()} found`} detail="New records will appear here automatically." />}
      renderItem={({ item, index }) => <RecordCard record={item} icon={moduleIcons[module]} index={index} fallbackTitle={activeLabel.replace(/s$/, '')} />}
    />}
  </View>
}

function RecordCard({ record, icon, index, fallbackTitle }: { record: OperationRecord; icon: ComponentProps<typeof Ionicons>['name']; index: number; fallbackTitle: string }) {
  const values = Object.entries(record).filter(([key, value]) => key !== 'id' && !key.endsWith('Id') && typeof value !== 'object' && value !== null && value !== '')
  const titleKey = ['name', 'title', 'bookingNo', 'invoiceNo', 'employeeCode', 'driverCode', 'email', 'phone', 'status'].find((key) => values.some(([candidate]) => candidate === key))
  const titleEntry = values.find(([key]) => key === titleKey)
  const details = values.filter(([key]) => key !== titleKey).slice(0, 2)
  return <View style={styles.card}>
    <View style={styles.recordIcon}><Ionicons name={icon} size={20} color={palette.primary} /></View>
    <View style={styles.recordBody}>
      <Text style={styles.title} numberOfLines={1}>{titleEntry ? String(titleEntry[1]) : `${fallbackTitle} ${index + 1}`}</Text>
      {details.map(([key, value]) => <Text key={key} style={styles.detail} numberOfLines={1}><Text style={styles.detailLabel}>{label(key)}:</Text> {String(value)}</Text>)}
    </View>
    <Ionicons name="chevron-forward" size={19} color="#a3b5ad" />
  </View>
}

function label(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

const moduleIcons: Record<OperationModule, ComponentProps<typeof Ionicons>['name']> = {
  services: 'sparkles-outline',
  customers: 'people-outline',
  employees: 'id-card-outline',
  attendance: 'time-outline',
  invoices: 'receipt-outline',
  inventory: 'cube-outline',
  complaints: 'warning-outline',
  notifications: 'notifications-outline',
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 20, paddingBottom: 6 },
  modules: { gap: 8, paddingRight: 10 },
  module: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 13, backgroundColor: palette.surfaceMuted, borderWidth: 1, borderColor: '#e3eee9' },
  activeModule: { backgroundColor: palette.primary, borderColor: palette.primary },
  moduleText: { color: palette.muted, fontWeight: '700', fontSize: 12 },
  activeModuleText: { color: '#fff' },
  resultBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 6 },
  resultTitle: { color: palette.inkSoft, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  count: { minWidth: 27, height: 27, borderRadius: 10, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  list: { flexGrow: 1, padding: 20, paddingTop: 8, paddingBottom: 110, gap: 11 },
  card: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 14, ...cardShadow },
  recordIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  recordBody: { flex: 1, gap: 3 },
  title: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  detail: { color: palette.muted, fontSize: 12 },
  detailLabel: { color: palette.inkSoft, fontWeight: '600' },
})
