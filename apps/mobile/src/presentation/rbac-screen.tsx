import { useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

type Role = { id: 'admin' | 'driver' | 'customer' | 'cleaner'; name: string; description: string }
type User = { id: string; name: string; email: string; role: Role['id']; status: string }

export function RbacScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/rbac`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(d => {
        setUsers(d.users || [])
        setRoles(d.roles || [])
      })
      .catch(() => Alert.alert('Error', 'Could not load access control.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const assignRole = async (userId: string, role: Role['id']) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/rbac`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ userId, role })
      })
      if (!res.ok) throw new Error('Role update failed')
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  const resetPassword = (user: User) => {
    Alert.alert('Reset Password', `Reset password for ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/khobra-cleaning/rbac`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ userId: user.id })
          })
          const d = await res.json()
          if (!res.ok) throw new Error(d.error || 'Password reset failed')
          Alert.alert('Password Reset', `Temporary password for ${user.name}:\n\n${d.temporaryPassword}\n\nPlease copy this now.`)
        } catch (e: any) {
          Alert.alert('Error', e.message)
        }
      }}
    ])
  }

  const openPicker = (user: User) => {
    setSelectedUser(user)
    setPickerOpen(true)
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Access Control" subtitle="Manage roles and permissions" />
    </View>

    {loading ? <LoadingState label="Loading users..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={users}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="shield-checkmark-outline" title="No Users" detail="No user data available." />}
      renderItem={({ item: u }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.identity}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.info}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.email}>{u.email}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: u.status === 'active' ? '#d1fae5' : '#f3f4f6' }]}>
              <Text style={[styles.statusText, { color: u.status === 'active' ? '#047857' : '#4b5563' }]}>{u.status}</Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Pressable style={styles.roleBtn} onPress={() => openPicker(u)}>
              <Text style={styles.roleBtnLabel}>Role</Text>
              <View style={styles.roleBtnValBox}>
                <Text style={styles.roleBtnVal}>{u.role}</Text>
                <Ionicons name="chevron-down" size={14} color={palette.muted} />
              </View>
            </Pressable>
            <Pressable style={styles.resetBtn} onPress={() => resetPassword(u)}>
              <Ionicons name="key-outline" size={16} color={palette.ink} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
          </View>
        </View>
      )}
    />}

    <Modal visible={pickerOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Select Role for {selectedUser?.name}</Text>
          {roles.map(r => (
            <Pressable key={r.id} style={styles.optionRow} onPress={() => {
              if (selectedUser) assignRole(selectedUser.id, r.id)
              setPickerOpen(false)
            }}>
              <Text style={styles.optionText}>{r.name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.optionCancel} onPress={() => setPickerOpen(false)}><Text style={styles.optionCancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  
  list: { padding: 20, gap: 14, paddingBottom: 100 },
  card: { backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: palette.primaryDark },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: palette.ink },
  email: { fontSize: 12, color: palette.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  
  actionsRow: { flexDirection: 'row', gap: 10 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 12 },
  roleBtnLabel: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  roleBtnValBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleBtnVal: { fontSize: 13, fontWeight: '700', color: palette.ink, textTransform: 'capitalize' },
  
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: palette.ink },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 20 },
  optionsBox: { backgroundColor: palette.surface, borderRadius: 16, overflow: 'hidden' },
  optionsTitle: { padding: 20, fontSize: 15, fontWeight: '600', textAlign: 'center', borderBottomWidth: 1, borderBottomColor: palette.border },
  optionRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  optionText: { fontSize: 16, textAlign: 'center', color: palette.ink, textTransform: 'capitalize' },
  optionCancel: { padding: 18, backgroundColor: '#f9fafb' },
  optionCancelText: { fontSize: 16, textAlign: 'center', color: palette.danger, fontWeight: '600' }
})
