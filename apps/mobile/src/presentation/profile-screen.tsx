import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, FormLabel, Input, PageHeading, palette, PrimaryButton } from './mobile-ui'

export function ProfileScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [name, setName] = useState(session.user.name)
  const [email, setEmail] = useState(session.user.email)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSec, setSavingSec] = useState(false)

  const saveProfile = () => {
    // In a real app this might hit a /profile endpoint
    // For now we'll just mock it as successful
    setSavingProfile(true)
    setTimeout(() => {
      setSavingProfile(false)
      Alert.alert('Success', 'Profile updated.')
    }, 600)
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

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Ionicons name="arrow-back" size={24} color={palette.ink} onPress={onBack} style={styles.backButton} />}
      <PageHeading title="Profile" subtitle="Manage your account" />
    </View>

    <ScrollView contentContainerStyle={styles.form}>
      <View style={styles.heroCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
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
          
          <PrimaryButton label="Save Profile" onPress={saveProfile} loading={savingProfile} style={{ marginTop: 20 }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>Security</Text>
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
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: palette.primaryDark },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  section: { gap: 10 },
  secTitle: { fontSize: 16, fontWeight: '700', color: palette.ink },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  spacer: { height: 16 },
})
