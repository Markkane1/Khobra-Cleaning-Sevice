'use client'

import { useEffect, useState } from 'react'

const decodeKey = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0))

export function PushToggle() {
  const [enabled, setEnabled] = useState(false)
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  useEffect(() => { if (supported) navigator.serviceWorker.getRegistration('/push-sw.js').then(registration => registration?.pushManager.getSubscription()).then(subscription => setEnabled(Boolean(subscription))) }, [supported])
  if (!supported) return null
  const toggle = async () => {
    const registration = await navigator.serviceWorker.register('/push-sw.js')
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await fetch('/api/khobra-cleaning/notifications/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) })
      await existing.unsubscribe(); setEnabled(false); return
    }
    if (await Notification.requestPermission() !== 'granted') return
    const config = await fetch('/api/khobra-cleaning/notifications/push').then(response => response.json())
    if (!config.publicKey) throw new Error('Push notifications are not configured')
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) })
    const response = await fetch('/api/khobra-cleaning/notifications/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
    if (!response.ok) throw new Error('Push subscription failed')
    setEnabled(true)
  }
  return <button type="button" onClick={() => void toggle()} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">{enabled ? 'Disable push' : 'Enable push'}</button>
}
