import { useEffect, useState } from 'react'
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as Location from 'expo-location'
import type { Session } from '../domain/auth/types'
import { request, upload } from '../infrastructure/http/api-client'
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
  const [latitude, setLatitude] = useState<number>()
  const [longitude, setLongitude] = useState<number>()
  const [locating, setLocating] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSec, setSavingSec] = useState(false)

  useEffect(() => {
    request<{ user?: { avatarUrl?: string; phone?: string } }>('/api/khobra-cleaning/auth/me', {}, session.token)
      .then(result => {
        setAvatarUrl(result.user?.avatarUrl || '')
        if (session.user.role !== 'customer') setPhone(result.user?.phone || '')
      })
      .catch(() => undefined)
  }, [session.token])

  useEffect(() => {
    if (session.user.role !== 'customer') return
    request<any[]>('/api/khobra-cleaning/customers', {}, session.token)
      .then(records => {
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
        setLatitude(typeof primary?.latitude === 'number' ? primary.latitude : undefined)
        setLongitude(typeof primary?.longitude === 'number' ? primary.longitude : undefined)
      })
      .catch(error => Alert.alert('Could not load profile', error.message))
  }, [session.token, session.user.email, session.user.name, session.user.role])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      if (session.user.role !== 'customer') {
        await request('/api/khobra-cleaning/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), ...(phone.trim() ? { phone: phone.trim() } : {}) }),
        }, session.token)
        Alert.alert('Success', 'Profile updated.')
        return
      }
      if (!customer) throw new Error('Customer profile could not be loaded')
      const hasPin = latitude !== undefined && longitude !== undefined
      if ((!address.trim() && !hasPin) || !city.trim()) throw new Error('Enter an address or use your current location')
      if (!hasPin && !area.trim()) throw new Error('Area is required for a manually entered address')
      const primary = { label: 'Primary', address: address.trim() || 'Pinned GPS location', city: city.trim(), area: area.trim(), latitude, longitude }
      const remaining = Array.isArray(customer.addresses) ? customer.addresses.slice(1) : []
      const saved = await request<any>('/api/khobra-cleaning/customers', {
        method: 'PUT',
        body: JSON.stringify({ id: customer.id, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), addresses: [primary, ...remaining], address: primary.address, city: primary.city, area: primary.area }),
      }, session.token)
      setCustomer(saved)
      Alert.alert('Success', 'Profile and primary address updated.')
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  const usePhoneGps = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') throw new Error('Location permission was not granted. You can still enter the address manually.')
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(Number(position.coords.latitude.toFixed(6)))
      setLongitude(Number(position.coords.longitude.toFixed(6)))
      if (!address.trim()) setAddress('Pinned GPS location')
    } catch (error) {
      Alert.alert('Could not use GPS', error instanceof Error ? error.message : 'Check GPS and try again, or enter the address manually.')
    } finally {
      setLocating(false)
    }
  }

  const useManualAddress = () => {
    setLatitude(undefined)
    setLongitude(undefined)
    if (address === 'Pinned GPS location') setAddress('')
  }

  const openGpsPin = () => {
    if (latitude === undefined || longitude === undefined) return
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`)
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'New passwords do not match')
    }
    setSavingSec(true)
    try {
      await request('/api/khobra-cleaning/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      }, session.token)
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
            <Text style={styles.locationMethodLabel}>How would you like to provide the location?</Text>
            <View style={styles.locationMethods}>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: latitude === undefined }} onPress={useManualAddress} style={({ pressed }) => [styles.locationMethod, latitude === undefined && styles.locationMethodActive, pressed && styles.methodPressed]}><Ionicons name="create-outline" size={18} color={latitude === undefined ? palette.primaryDark : palette.muted} /><Text style={[styles.locationMethodText, latitude === undefined && styles.locationMethodTextActive]}>Enter manually</Text></Pressable>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: latitude !== undefined, busy: locating }} disabled={locating} onPress={usePhoneGps} style={({ pressed }) => [styles.locationMethod, latitude !== undefined && styles.locationMethodActive, pressed && styles.methodPressed, locating && styles.methodDisabled]}><Ionicons name={locating ? 'hourglass-outline' : 'locate-outline'} size={18} color={latitude !== undefined ? palette.primaryDark : palette.muted} /><Text style={[styles.locationMethodText, latitude !== undefined && styles.locationMethodTextActive]}>{locating ? 'Finding GPS...' : 'Use phone GPS'}</Text></Pressable>
            </View>
            {latitude !== undefined && longitude !== undefined ? <View style={styles.pinCard}><View><Text style={styles.pinTitle}>GPS pin saved</Text><Text style={styles.pinCoordinates}>{latitude}, {longitude}</Text></View><Pressable accessibilityRole="link" onPress={openGpsPin} style={({ pressed }) => [styles.mapLink, pressed && styles.methodPressed]}><Ionicons name="map-outline" size={18} color={palette.primaryDark} /><Text style={styles.mapLinkText}>View in Maps</Text></Pressable></View> : null}
            <FormLabel label={latitude !== undefined ? 'Building or access details (optional)' : 'Address'} />
            <Input value={address === 'Pinned GPS location' ? '' : address} onChangeText={setAddress} placeholder={latitude !== undefined ? 'Villa, apartment, floor, or access notes' : 'Building, street, apartment'} autoComplete="street-address" />
            <View style={styles.spacer} />
            <FormLabel label={latitude !== undefined ? 'Area (optional)' : 'Area'} />
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
  roleText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  section: { gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  spacer: { height: 16 },
  addressTitle: { color: palette.primaryDark, fontSize: 16, fontWeight: '800', marginBottom: 12 },
  locationMethodLabel: { color: palette.inkSoft, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  locationMethods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  locationMethod: { flex: 1, minWidth: 135, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 8, backgroundColor: palette.surface },
  locationMethodActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  locationMethodText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  locationMethodTextActive: { color: palette.primaryDark },
  methodPressed: { opacity: 0.72 },
  methodDisabled: { opacity: 0.55 },
  pinCard: { marginBottom: 12, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12, gap: 8 },
  pinTitle: { color: palette.primaryDark, fontWeight: '800', fontSize: 14 },
  pinCoordinates: { color: palette.primaryDark, fontSize: 12, marginTop: 2 },
  mapLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, backgroundColor: '#fff' },
  mapLinkText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
})
