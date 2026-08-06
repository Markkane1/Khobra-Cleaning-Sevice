import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { request } from '../http/api-client'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
})

export async function registerNativePush(token: string) {
  if (!Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('khobra_updates', {
    name: 'Booking updates', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250],
  })
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) return
  const deviceToken = await Notifications.getDevicePushTokenAsync()
  await request('/api/khobra-cleaning/notifications/push', {
    method: 'POST', body: JSON.stringify({ platform: Platform.OS, token: String(deviceToken.data) }),
  }, token)
}
