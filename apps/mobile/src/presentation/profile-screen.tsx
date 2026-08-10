import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl, request, upload } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, PageHeading, palette, PrimaryButton } from './mobile-ui'

export function ProfileScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [customer, setCustomer] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [name, setName] = useState(session.user.name)
  const [email, setEmail] = useState(session.user.email)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Dubai')
  const [area, setArea] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSec, setSavingSec] = useState(false)

  useEffect(() => {
    request<{ user?: { avatarUrl?: string } }>('/api/khobra-cleaning/auth/me', {}, session.token)
      .then(result => setAvatarUrl(result.user?.avatarUrl || ''))
      .catch(() => undefined)
  }, [session.token])

  useEffect(() => {
    if (session.user.role !== 'customer') return
    fetch(`${apiBaseUrl}/api/khobra-cleaning/customers`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async response => {
        const records = await response.json()
        if (!response.ok) throw new Error(records.error || 'Could not load profile')
        const record = records[0]
        if (!record) return
        const primary = Array.isArray(record.addresses) ? record.addresses[0] : undefined
        setCustomer(record)
        setName(record.user?.name || session.user.name)
        setEmail(record.user?.email || session.user.email)
        setPhone(record.phone || '')
        setAddress(primary?.address || record.address || '')
        setCity(primary?.city || record.city || 'Dubai')
        setArea(primary?.area || record.area || '')
      })
      .catch(error => Alert.alert('Could not load profile', error.message))
  }, [session.token, session.user.email, session.user.name, session.user.role])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      if (session.user.role !== 'customer') {
        Alert.alert('Success', 'Profile updated.')
        return
      }
      if (!customer) throw new Error('Customer profile could not be loaded')
      if (!address.trim() || !area.trim() || !city.trim()) throw new Error('Address, area, and city are required')
      const primary = { label: 'Primary', address: address.trim(), city: city.trim(), area: area.trim() }
      const remaining = Array.isArray(customer.addresses) ? customer.addresses.slice(1) : []
      const response = await fetch(`${apiBaseUrl}/api/khobra-cleaning/customers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ id: customer.id, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), addresses: [primary, ...remaining], address: primary.address, city: primary.city, area: primary.area }),
      })
      const saved = await response.json()
      if (!response.ok) throw new Error(saved.error || 'Could not save profile')
      setCustomer(saved)
      Alert.alert('Success', 'Profile and primary address updated.')
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'New passwords do not match')
    }
    setSavingSec(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/auth/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      if (!res.ok) throw new Error('Could not change password')
      Alert.alert('Success', 'Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSavingSec(false)
    }
  }

  const chooseProfilePhoto = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true })
    if (result.canceled) return
    const asset = result.assets[0]
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('folder', 'profile-photos')
      form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'image/jpeg' } as any)
      const uploaded = await upload('/api/khobra-cleaning/upload', form, session.token)
      await request('/api/khobra-cleaning/auth/me', { method: 'PUT', body: JSON.stringify({ avatarUrl: uploaded.url }) }, session.token)
      setAvatarUrl(uploaded.url)
      Alert.alert('Success', 'Profile photo updated.')
    } catch (error) {
      Alert.alert('Could not upload photo', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Ionicons name="arrow-back" size={24} color={palette.ink} onPress={onBack} style={styles.backButton} />}
      <PageHeading title="Profile" subtitle="Manage your account" />
    </View>

    <ScrollView contentContainerStyle={styles.form}>
      <View style={styles.heroCard}>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload profile photo" disabled={uploadingAvatar} onPress={chooseProfilePhoto} style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} resizeMode="cover" style={styles.avatarImage} accessibilityLabel={`${name}'s profile photo`} /> : <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>}
          <View style={styles.cameraBadge}><Ionicons name={uploadingAvatar ? 'hourglass-outline' : 'camera-outline'} size={16} color={palette.primaryDark} /></View>
        </Pressable>
        <Text style={styles.heroName}>{name}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{session.user.role}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>Personal Details</Text>
        <View style={styles.card}>
          <FormLabel label="Full Name" />
          <Input value={name} onChangeText={setName} />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Email Address" />
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" />

          <View style={styles.spacer} />
          <FormLabel label="Phone Number" />
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          {session.user.role === 'customer' ? <>
            <View style={styles.spacer} />
            <Text style={styles.addressTitle}>Primary Address</Text>
            <FormLabel label="Address" />
            <Input value={address} onChangeText={setAddress} placeholder="Building, street, apartment" autoComplete="street-address" />
            <View style={styles.spacer} />
            <FormLabel label="Area" />
            <Input value={area} onChangeText={setArea} placeholder="Dubai Marina" />
            <View style={styles.spacer} />
            <FormLabel label="City" />
            <Input value={city} onChangeText={setCity} placeholder="Dubai" />
          </> : null}
          
          <PrimaryButton label="Save Profile" onPress={saveProfile} loading={savingProfile} style={{ marginTop: 20 }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>Change Password</Text>
        <View style={styles.card}>
          <FormLabel label="Current Password" />
          <Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          
          <View style={styles.spacer} />
          
          <FormLabel label="New Password" />
          <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          
          <View style={styles.spacer} />
          
          <FormLabel label="Confirm New Password" />
          <Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          
          <PrimaryButton label="Update Password" onPress={savePassword} loading={savingSec} style={{ marginTop: 20, backgroundColor: palette.ink }} />
        </View>
      </View>

    </ScrollView>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  
  form: { padding: 20, gap: 24, paddingBottom: 100 },
  
  heroCard: { backgroundColor: palette.primary, padding: 24, borderRadius: 20, alignItems: 'center', ...cardShadow },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarPressed: { opacity: 0.8 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 32, fontWeight: '800', color: palette.primaryDark },
  cameraBadge: { position: 'absolute', right: 5, bottom: 5, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  section: { gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  spacer: { height: 16 },
  addressTitle: { color: palette.primaryDark, fontSize: 15, fontWeight: '800', marginBottom: 12 },
})
