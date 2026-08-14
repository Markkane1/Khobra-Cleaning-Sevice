import { io } from 'socket.io-client'
import { apiBaseUrl } from './http/api-client'

export function subscribeRealtime(token: string, events: string[], refresh: () => void) {
  if (!apiBaseUrl) return () => {}
  const socket = io(`${apiBaseUrl}/?XTransformPort=3003`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  })
  events.forEach(event => socket.on(event, refresh))
  return () => { socket.disconnect() }
}
