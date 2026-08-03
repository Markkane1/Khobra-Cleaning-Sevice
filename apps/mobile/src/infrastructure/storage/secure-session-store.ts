import * as SecureStore from 'expo-secure-store'
import type { SessionStore } from '../../application/ports'
import type { Session } from '../../domain/auth/types'

const SESSION_KEY = 'khobra.session'

export const secureSessionStore: SessionStore = {
  async read() {
    try {
      const value = await SecureStore.getItemAsync(SESSION_KEY)
      if (!value) return null
      const session = JSON.parse(value) as Session
      if (!session.token || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
        await SecureStore.deleteItemAsync(SESSION_KEY)
        return null
      }
      return session
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY)
      return null
    }
  },
  async write(session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
  },
  async clear() {
    await SecureStore.deleteItemAsync(SESSION_KEY)
  },
}
