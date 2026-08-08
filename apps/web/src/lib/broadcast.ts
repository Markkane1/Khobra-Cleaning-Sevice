// Helper to broadcast real-time events via the WebSocket HTTP bridge
// API routes call this after mutations to notify connected clients

import { after } from 'next/server'

const WS_BRIDGE_URL = process.env.WS_BRIDGE_URL || 'http://127.0.0.1:3003'

export type BroadcastEvent =
  | 'booking:created' | 'booking:updated' | 'booking:deleted'
  | 'invoice:created' | 'invoice:updated'
  | 'payment:created' | 'payment:updated'
  | 'complaint:created' | 'complaint:updated' | 'complaint:resolved'
  | 'employee:created' | 'employee:updated'
  | 'customer:created' | 'customer:updated'
  | 'service:created' | 'service:updated'
  | 'attendance:created' | 'attendance:updated' | 'attendance:deleted'
  | 'dispatch:assigned' | 'dispatch:updated'
  | 'inventory:updated'
  | 'payroll:updated'
  | 'session:revoked'

export function broadcast(
  type: BroadcastEvent,
  payload: Record<string, unknown>,
  tenantId?: string,
  userId?: string,
) {
  after(async () => {
    const secret = process.env.REALTIME_SECRET
    if (!secret) {
      console.error('[realtime] Broadcast failed', { type, tenantId, userId, error: 'REALTIME_SECRET must be configured' })
      return
    }
    let lastError = 'Unknown bridge error'
    for (const delay of [0, 250, 1_000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      try {
        const response = await fetch(`${WS_BRIDGE_URL}/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ type, payload, tenantId, userId }),
          signal: AbortSignal.timeout(5_000),
        })
        if (response.ok) return
        lastError = `Realtime bridge returned ${response.status}`
        if (response.status < 500) break
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    console.error('[realtime] Broadcast failed after retries', { type, tenantId, userId, error: lastError })
  })
}



