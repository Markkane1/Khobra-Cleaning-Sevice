import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const palette = {
  background: '#f3faf7',
  surface: '#ffffff',
  surfaceMuted: '#edf5f1',
  primary: '#059669',
  primaryDark: '#047857',
  primarySoft: '#d1fae5',
  tealSoft: '#ccfbf1',
  ink: '#15251d',
  inkSoft: '#344b42',
  muted: '#64766f',
  border: '#dce9e3',
  danger: '#dc2626',
  warning: '#d97706',
}

export function localDateValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export const headingFont = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium' })
type IconName = ComponentProps<typeof Ionicons>['name']

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <View style={styles.pageHeading}>
    <View style={styles.pageHeadingText}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>
    {action}
  </View>
}

export function PrimaryButton({ label, onPress, icon = 'arrow-forward', loading = false, disabled = false }: { label: string; onPress: () => void; icon?: IconName; loading?: boolean; disabled?: boolean }) {
  const inactive = loading || disabled
  return <Pressable accessibilityRole="button" disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, inactive && styles.disabled]}>
    {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonText}>{label}</Text><Ionicons name={icon} size={18} color="#fff" /></>}
  </Pressable>
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
    {icon ? <Ionicons name={icon} size={18} color={palette.primaryDark} /> : null}<Text style={styles.secondaryButtonText}>{label}</Text>
  </Pressable>
}

export function LoadingState({ label = 'Loading your workspace...' }: { label?: string }) {
  return <View style={styles.state}><View style={styles.stateIcon}><ActivityIndicator size="large" color={palette.primary} /></View><Text style={styles.stateTitle}>{label}</Text></View>
}

export function MessageState({ icon, title, detail, action }: { icon: IconName; title: string; detail: string; action?: ReactNode }) {
  return <View style={styles.state}><View style={styles.stateIcon}><Ionicons name={icon} size={28} color={palette.primary} /></View><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDetail}>{detail}</Text>{action}</View>
}

export const cardShadow = {
  shadowColor: '#064e3b',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const

const styles = StyleSheet.create({
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 },
  pageHeadingText: { flex: 1 },
  pageTitle: { fontFamily: headingFont, color: palette.ink, fontSize: 25, fontWeight: '700', letterSpacing: -0.4 },
  pageSubtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  primaryButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: '#b9d9cb', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { color: palette.primaryDark, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  state: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 28 },
  stateIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, marginBottom: 15 },
  stateTitle: { fontFamily: headingFont, color: palette.ink, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  stateDetail: { color: palette.muted, textAlign: 'center', fontSize: 13, lineHeight: 20, maxWidth: 300, marginTop: 7, marginBottom: 18 },
})
