import type { ComponentProps } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { cardShadow, PageHeading, palette } from './mobile-ui'

type AdminModule = 'dispatch' | 'payroll' | 'branches' | 'rbac' | 'settings' | 'reports' | 'profile'

const adminModules: ReadonlyArray<{ id: AdminModule; label: string; icon: ComponentProps<typeof Ionicons>['name']; description: string }> = [
  { id: 'dispatch', label: 'Dispatch', icon: 'map-outline', description: 'Driver and job routing' },
  { id: 'payroll', label: 'Payroll', icon: 'cash-outline', description: 'Employee salaries & advances' },
  { id: 'branches', label: 'Branches', icon: 'location-outline', description: 'Location management' },
  { id: 'rbac', label: 'Access Control', icon: 'shield-checkmark-outline', description: 'Roles and permissions' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-outline', description: 'Operational analytics' },
  { id: 'settings', label: 'Company', icon: 'business-outline', description: 'Information, bank accounts, and configuration' },
  { id: 'profile', label: 'My Profile', icon: 'person-outline', description: 'Account settings' },
]

export function AdminHubScreen({ session, onNavigate }: { session: Session; onNavigate: (screen: AdminModule) => void }) {
  if (session.user.role !== 'admin') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}><PageHeading title="Access Denied" subtitle="Administrator privileges required." /></View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <PageHeading title="Admin Hub" subtitle="Back-office management and configuration." />
      </View>
      
      <ScrollView contentContainerStyle={styles.grid}>
        {adminModules.map((item) => (
          <Pressable key={item.id} style={styles.card} onPress={() => onNavigate(item.id)}>
            <View style={styles.iconBox}>
              <Ionicons name={item.icon} size={24} color={palette.primary} />
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.label}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} style={{ opacity: 0.5 }} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  grid: { padding: 20, paddingBottom: 120, gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: palette.border, ...cardShadow, gap: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: 2 },
  description: { fontSize: 13, color: palette.muted, lineHeight: 18 },
})
