import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

type NotificationItem = { id: string; title: string; message: string; type: string; read: boolean; createdAt: string }

export function NotificationsScreen({ session, onBack }: { session: Session; onBack?: () => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${apiBaseUrl}/api/khobra-cleaning/notifications?channel=in_app`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json())
      .then(setNotifications)
      .catch(() => Alert.alert('Error', 'Could not load notifications.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const markAllRead = async () => {
    setRefreshing(true)
    try {
      await fetch(`${apiBaseUrl}/api/khobra-cleaning/notifications?channel=in_app`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ markAllRead: true })
      })
      load()
    } catch {
      Alert.alert('Error', 'Failed to mark as read.')
    } finally {
      setRefreshing(false)
    }
  }

  const getTypeStyle = (type: string) => {
    if (type === 'urgent' || type === 'warning') return { icon: 'warning', color: '#f59e0b', bg: '#fef3c7' }
    if (type === 'error') return { icon: 'alert-circle', color: '#ef4444', bg: '#fee2e2' }
    if (type === 'success') return { icon: 'checkmark-circle', color: '#10b981', bg: '#d1fae5' }
    return { icon: 'information-circle', color: '#0ea5e9', bg: '#e0f2fe' }
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={palette.ink} /></Pressable>}
      <PageHeading title="Notifications" subtitle="System alerts and announcements" />
      {notifications.some(n => !n.read) && (
        <Pressable style={styles.markBtn} onPress={markAllRead} disabled={refreshing}>
          <Ionicons name="checkmark-done" size={16} color={palette.primaryDark} />
          <Text style={styles.markBtnText}>Mark All as Read</Text>
        </Pressable>
      )}
    </View>

    {loading ? <LoadingState label="Loading notifications..." /> : <FlatList
      contentContainerStyle={styles.list}
      data={notifications}
      keyExtractor={item => item.id}
      ListEmptyComponent={<MessageState icon="notifications-outline" title="You're all caught up" detail="No new notifications." />}
      renderItem={({ item: n }) => {
        const style = getTypeStyle(n.type)
        return <View style={[styles.card, !n.read && styles.unreadCard]}>
          <View style={[styles.iconBox, { backgroundColor: style.bg }]}><Ionicons name={style.icon as any} size={20} color={style.color} /></View>
          <View style={styles.content}>
            <Text style={[styles.title, !n.read && styles.unreadText]}>{n.title}</Text>
            <Text style={styles.message}>{n.message}</Text>
            <Text style={styles.time}>{new Date(n.createdAt).toLocaleString()}</Text>
          </View>
          {!n.read && <View style={styles.dot} />}
        </View>
      }}
    />}
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { padding: 20, paddingBottom: 10 },
  backButton: { marginBottom: 10 },
  markBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: palette.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 12 },
  markBtnText: { color: palette.primaryDark, fontSize: 13, fontWeight: '700' },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: palette.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.border, ...cardShadow },
  unreadCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: palette.ink, marginBottom: 4 },
  unreadText: { fontWeight: '800' },
  message: { fontSize: 14, color: palette.muted, lineHeight: 20, marginBottom: 8 },
  time: { fontSize: 11, color: palette.muted, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, position: 'absolute', top: 16, right: 16 }
})
