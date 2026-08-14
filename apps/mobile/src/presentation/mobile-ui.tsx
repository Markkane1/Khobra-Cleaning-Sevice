import type { ComponentProps, ReactNode } from 'react'
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
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

export function PrimaryButton({ label, onPress, icon = 'arrow-forward', loading = false, disabled = false, style }: { label: string; onPress: () => void; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const inactive = loading || disabled
  return <Pressable accessibilityRole="button" disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, pressed && styles.pressed, inactive && styles.disabled]}>
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

export function FormLabel({ label }: { label: string }) {
  return <Text style={styles.formLabel}>{label}</Text>
}

export function Input(props: TextInputProps) {
  const numeric = props.inputMode === 'numeric' || props.inputMode === 'decimal' || ['numeric', 'number-pad', 'decimal-pad'].includes(props.keyboardType || '')
  if (!numeric) return <TextInput {...props} style={[styles.input, props.multiline && styles.inputMultiline, props.style]} placeholderTextColor={palette.muted} />

  const value = Math.max(0, Math.trunc(Number(props.value) || 0))
  const update = (next: number | string) => props.onChangeText?.(String(Math.max(0, Math.trunc(Number(next) || 0))))
  const disabled = props.editable === false
  return <View style={styles.numberInput}>
    <Pressable accessibilityRole="button" accessibilityLabel="Decrease value" disabled={disabled || value === 0} onPress={() => update(value - 1)} style={({ pressed }) => [styles.numberButton, (disabled || value === 0) && styles.disabled, pressed && styles.pressed]}><Ionicons name="remove" size={20} color={palette.ink} /></Pressable>
    <TextInput {...props} value={String(value)} inputMode="numeric" keyboardType="number-pad" onChangeText={update} style={[styles.numberTextInput, props.style]} placeholderTextColor={palette.muted} />
    <Pressable accessibilityRole="button" accessibilityLabel="Increase value" disabled={disabled} onPress={() => update(value + 1)} style={({ pressed }) => [styles.numberButton, disabled && styles.disabled, pressed && styles.pressed]}><Ionicons name="add" size={20} color={palette.ink} /></Pressable>
  </View>
}

export function SelectButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" style={styles.selectButton} onPress={onPress}>
    <Text numberOfLines={1} style={value ? styles.selectValue : styles.selectPlaceholder}>{value || label}</Text>
    <Ionicons name="chevron-down" size={20} color={palette.muted} />
  </Pressable>
}

const styles = StyleSheet.create({
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 },
  pageHeadingText: { flex: 1, flexShrink: 1, minWidth: 0 },
  pageTitle: { fontFamily: headingFont, color: palette.ink, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  pageSubtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  primaryButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: palette.primaryDark, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: '#b9d9cb', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { color: palette.primaryDark, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  state: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 28 },
  stateIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, marginBottom: 15 },
  stateTitle: { fontFamily: headingFont, color: palette.ink, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  stateDetail: { color: palette.muted, textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 300, marginTop: 7, marginBottom: 18 },
  formLabel: { color: palette.ink, fontSize: 14, fontWeight: '700', marginBottom: 6, marginLeft: 4 },
  input: { minHeight: 48, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 16, color: palette.ink, fontSize: 14 },
  inputMultiline: { minHeight: 100, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  numberInput: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14 },
  numberButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceMuted },
  numberTextInput: { flex: 1, minWidth: 44, minHeight: 48, paddingHorizontal: 8, color: palette.ink, fontSize: 14, textAlign: 'center' },
  selectButton: { minHeight: 48, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectPlaceholder: { flex: 1, flexShrink: 1, color: palette.muted, fontSize: 14 },
  selectValue: { flex: 1, flexShrink: 1, color: palette.ink, fontSize: 14 },
})
