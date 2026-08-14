'use client'

import { useEffect, useState } from 'react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const TOKEN_KEY = 'khobra_native_push_token'
const ENABLED_KEY = 'khobra_native_push_enabled'
const PENDING_PATH_KEY = 'khobra_pending_push_path'
const STATE_EVENT = 'khobra:native-push-state'
const decodeKey = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0))
const nativePlatform = () => Capacitor.getPlatform() as 'android' | 'ios' | 'web'

type StoredToken = { platform: 'android' | 'ios'; token: string }

const storedToken = (): StoredToken | null => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') }
  catch { return null }
}

const pushEnabled = () => localStorage.getItem(ENABLED_KEY) === 'true' || Boolean(storedToken())
const navigate = (path: string) => {
  const target = new URL(path, window.location.origin)
  if (target.origin !== window.location.origin) return
  window.history.pushState(null, '', `${target.pathname}${target.search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function NativePushBridge({ userId }: { userId?: string }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const platform = nativePlatform()
    if (platform === 'web') return
    let handles: PluginListenerHandle[] = []
    let cancelled = false

    const setup = async () => {
      if (platform === 'android') await PushNotifications.createChannel({
        id: 'khobra_updates', name: 'Booking updates', description: 'Booking status and urgent pickup updates', importance: 4, vibration: true,
      })
      handles = await Promise.all([
        PushNotifications.addListener('registration', async ({ value: token }) => {
          if (!userId) return
          try {
            const response = await fetch('/api/khobra-cleaning/notifications/push', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, token }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Push registration failed')
            localStorage.setItem(TOKEN_KEY, JSON.stringify({ platform, token }))
            localStorage.setItem(ENABLED_KEY, 'true')
            window.dispatchEvent(new Event(STATE_EVENT))
            if (!result.configured) toast.warning(`${platform === 'ios' ? 'iOS' : 'Android'} push provider credentials are missing on the server.`)
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Push registration failed') }
        }),
        PushNotifications.addListener('registrationError', ({ error }) => {
          localStorage.removeItem(TOKEN_KEY)
          window.dispatchEvent(new Event(STATE_EVENT))
          toast.error(`Push registration failed: ${error}`)
        }),
        PushNotifications.addListener('pushNotificationReceived', () => queryClient.invalidateQueries({ queryKey: ['notifications'] })),
        PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const path = typeof notification.data?.url === 'string' ? notification.data.url : '/bookings'
          if (userId) navigate(path)
          else localStorage.setItem(PENDING_PATH_KEY, path)
        }),
      ])
      if (cancelled) return Promise.all(handles.map(handle => handle.remove()))
      if (userId) {
        const pendingPath = localStorage.getItem(PENDING_PATH_KEY)
        if (pendingPath) { localStorage.removeItem(PENDING_PATH_KEY); navigate(pendingPath) }
        let permission = await PushNotifications.checkPermissions()
        if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions()
        if (permission.receive === 'granted') {
          localStorage.setItem(ENABLED_KEY, 'true')
          await PushNotifications.register()
        }
      }
    }
    void setup().catch(error => toast.error(error instanceof Error ? error.message : 'Native push setup failed'))
    return () => { cancelled = true; void Promise.all(handles.map(handle => handle.remove())) }
  }, [queryClient, userId])

  return null
}

export function PushToggle() {
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const native = nativePlatform() !== 'web'
  const webSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

  useEffect(() => {
    if (native) {
      const refresh = () => setEnabled(pushEnabled() && Boolean(storedToken()))
      refresh()
      window.addEventListener(STATE_EVENT, refresh)
      return () => window.removeEventListener(STATE_EVENT, refresh)
    }
    if (webSupported) void navigator.serviceWorker.getRegistration('/push-sw.js')
      .then(registration => registration?.pushManager.getSubscription())
      .then(async subscription => {
        if (!subscription) return setEnabled(false)
        const response = await fetch('/api/khobra-cleaning/notifications/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
        setEnabled(response.ok)
      })
      .catch(() => setEnabled(false))
  }, [native, webSupported])

  if (native) return null
  if (!native && !webSupported) return null

  const toggle = async () => {
    setPending(true)
    try {
      if (native) {
        if (enabled) {
          const stored = storedToken()
          if (stored) {
            const response = await fetch('/api/khobra-cleaning/notifications/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stored) })
            if (!response.ok) throw new Error('Could not disable push notifications')
          }
          await PushNotifications.unregister()
          localStorage.removeItem(TOKEN_KEY)
          localStorage.setItem(ENABLED_KEY, 'false')
          setEnabled(false)
          return
        }
        let permission = await PushNotifications.checkPermissions()
        if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions()
        if (permission.receive !== 'granted') throw new Error('Notification permission was not granted')
        localStorage.setItem(ENABLED_KEY, 'true')
        await PushNotifications.register()
        return
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js')
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        const response = await fetch('/api/khobra-cleaning/notifications/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) })
        if (!response.ok) throw new Error('Could not disable push notifications')
        await existing.unsubscribe()
        setEnabled(false)
        return
      }
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notification permission was not granted')
      const config = await fetch('/api/khobra-cleaning/notifications/push').then(response => response.json())
      if (!config.publicKey) throw new Error('Web push is not configured')
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) })
      const response = await fetch('/api/khobra-cleaning/notifications/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
      if (!response.ok) throw new Error('Could not save the push subscription')
      setEnabled(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Push notification setup failed')
    } finally { setPending(false) }
  }

  return <button type="button" disabled={pending} onClick={() => void toggle()} className="text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50">{pending ? 'Working…' : enabled ? 'Disable push' : 'Enable push'}</button>
}
