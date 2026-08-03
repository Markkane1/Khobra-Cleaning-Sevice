import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { WebView } from 'react-native-webview'
import type { Session } from '../domain/auth/types'
import { apiBaseUrl } from '../infrastructure/http/api-client'
import { cardShadow, LoadingState, MessageState, PageHeading, palette } from './mobile-ui'

export function WorkspaceScreen({ session }: { session: Session }) {
  if (!apiBaseUrl) return <WorkspaceMessage title="Connect your workspace" detail="Set EXPO_PUBLIC_API_URL to securely open the full operations portal." />
  if (Constants.appOwnership === 'expo') return <WorkspaceMessage title="Secure workspace" detail="The full web workspace is available in the installed Android app." />
  return <AuthenticatedWorkspace session={session} url={apiBaseUrl} />
}

export async function clearWorkspaceSession() {
  if (!apiBaseUrl || Constants.appOwnership === 'expo') return
  const CookieManager = require('@preeternal/react-native-cookie-manager').default
  await Promise.all([
    CookieManager.clearByName(apiBaseUrl, 'khobra_session').catch(() => false),
    CookieManager.clearByName(apiBaseUrl, 'khobra_session', true).catch(() => false),
  ])
}

function WorkspaceMessage({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.screen}><View style={styles.header}><PageHeading title="Workspace" subtitle="Your complete Khobra operations portal." /></View><MessageState icon="shield-checkmark-outline" title={title} detail={detail} /></View>
}

function AuthenticatedWorkspace({ session, url }: { session: Session; url: string }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const CookieManager = require('@preeternal/react-native-cookie-manager').default
    const cookie = {
      name: 'khobra_session',
      value: session.token,
      domain: new URL(url).hostname,
      path: '/',
      secure: url.startsWith('https://'),
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
    }
    Promise.all([CookieManager.set(url, cookie), CookieManager.set(url, cookie, true)])
      .then(() => setReady(true))
      .catch(() => setError('Could not establish the secure workspace session.'))
  }, [session.expiresAt, session.token, url])

  if (error) return <WorkspaceMessage title="Could not connect" detail={error} />
  if (!ready) return <View style={styles.screen}><LoadingState label="Opening secure workspace..." /></View>
  return <View style={styles.screen}>
    <View style={styles.header}><PageHeading title="Workspace" subtitle="Your complete Khobra operations portal." /></View>
    <View style={styles.webCard}><WebView source={{ uri: url }} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled style={styles.webview} /></View>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: 20, paddingBottom: 0 },
  webCard: { flex: 1, overflow: 'hidden', margin: 20, marginTop: 4, marginBottom: 100, borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, ...cardShadow },
  webview: { flex: 1 },
})
