import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { request } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, LoadingState, PageHeading, palette, PrimaryButton } from './mobile-ui'
import { BankAccountsScreen } from './bank-accounts-screen'

export function SettingsScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<'information' | 'bank-accounts'>('information')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [currency, setCurrency] = useState('')
  const [timezone, setTimezone] = useState('')
  const [locale, setLocale] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [firstBookingTime, setFirstBookingTime] = useState('')
  const [lastWorkingTime, setLastWorkingTime] = useState('')

  const load = () => {
    setLoading(true)
    request<any>('/api/khobra-cleaning/settings', {}, session.token)
      .then(d => {
        const t = d.tenant || {}
        const s = d.settings || {}
        setName(t.name || '')
        setSlug(t.slug || '')
        setCurrency(t.currency || '')
        setTimezone(t.timezone || '')
        setLocale(t.locale || '')
        setTaxRate(String(t.taxRate ?? 0))
        setFirstBookingTime(t.firstBookingTime || '08:00')
        setLastWorkingTime(t.lastWorkingTime || '20:00')
        setPhone(s.phone || '')
        setAddress(s.address || '')
      })
      .catch(() => Alert.alert('Error', 'Could not load settings.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { name, slug, currency, locale, timezone, taxRate: Number(taxRate), firstBookingTime, lastWorkingTime, settings: { phone, address } }
      await request('/api/khobra-cleaning/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      }, session.token)
      Alert.alert('Success', 'Company settings saved.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Ionicons name="arrow-back" size={24} color={palette.ink} onPress={onBack} style={styles.backButton} />}
      <PageHeading title="Company" subtitle="Information, bank accounts, and configuration" />
      <View style={styles.tabs} accessibilityRole="tablist">
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'information' }} onPress={() => setActiveTab('information')} style={({ pressed }) => [styles.tab, activeTab === 'information' && styles.tabActive, pressed && styles.tabPressed]}>
          <Text style={[styles.tabText, activeTab === 'information' && styles.tabTextActive]}>Company Information</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'bank-accounts' }} onPress={() => setActiveTab('bank-accounts')} style={({ pressed }) => [styles.tab, activeTab === 'bank-accounts' && styles.tabActive, pressed && styles.tabPressed]}>
          <Text style={[styles.tabText, activeTab === 'bank-accounts' && styles.tabTextActive]}>Bank Accounts</Text>
        </Pressable>
      </View>
    </View>

    {activeTab === 'bank-accounts' ? <BankAccountsScreen session={session} embedded /> : loading ? <LoadingState label="Loading settings..." /> : <ScrollView contentContainerStyle={styles.form}>
      
      <View style={styles.section}>
        <View style={styles.secHead}><Ionicons name="business" size={18} color={palette.primaryDark} /><Text style={styles.secTitle}>Company Details</Text></View>
        <View style={styles.card}>
          <FormLabel label="Company Name" />
          <Input value={name} onChangeText={setName} placeholder="Khobra Cleaning Service" />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Contact Phone" />
          <Input value={phone} onChangeText={setPhone} placeholder="+971..." />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Address" />
          <Input value={address} onChangeText={setAddress} placeholder="Dubai..." />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.secHead}><Ionicons name="time" size={18} color={palette.primaryDark} /><Text style={styles.secTitle}>Operational Hours</Text></View>
        <View style={styles.card}>
          <FormLabel label="First Booking Time" />
          <Input value={firstBookingTime} onChangeText={setFirstBookingTime} placeholder="08:00" />
          <Text style={styles.helpText}>Earliest allowed start time for any booking.</Text>
          
          <View style={styles.spacer} />
          
          <FormLabel label="Last Working Time" />
          <Input value={lastWorkingTime} onChangeText={setLastWorkingTime} placeholder="20:00" />
          <Text style={styles.helpText}>Latest time assigned cleaners can complete work.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.secHead}><Ionicons name="globe" size={18} color={palette.primaryDark} /><Text style={styles.secTitle}>Localization & Billing</Text></View>
        <View style={styles.card}>
          <FormLabel label="Currency" />
          <Input value={currency} onChangeText={setCurrency} placeholder="AED" />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Tax Rate (%)" />
          <Input value={taxRate} onChangeText={setTaxRate} keyboardType="numeric" placeholder="5" />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Timezone" />
          <Input value={timezone} onChangeText={setTimezone} placeholder="Asia/Dubai" />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Locale" />
          <Input value={locale} onChangeText={setLocale} placeholder="en-AE" />
        </View>
      </View>

    </ScrollView>}
    
    {activeTab === 'information' && !loading && <View style={styles.footer}>
      <PrimaryButton label="Save Settings" onPress={save} loading={saving} />
    </View>}
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  tabs: { flexDirection: 'row', marginTop: 16, padding: 4, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  tab: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9 },
  tabActive: { backgroundColor: palette.primarySoft },
  tabPressed: { opacity: 0.7 },
  tabText: { fontSize: 14, fontWeight: '600', color: palette.muted, textAlign: 'center' },
  tabTextActive: { color: palette.primaryDark },
  
  form: { padding: 20, gap: 24, paddingBottom: 100 },
  section: { gap: 10 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  spacer: { height: 16 },
  helpText: { fontSize: 12, color: palette.muted, marginTop: 4 },
  
  footer: { padding: 20, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
})
