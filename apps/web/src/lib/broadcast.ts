// Helper to broadcast real-time events via the WebSocket HTTP bridge
// API routes call this after mutations to notify connected clients

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

export async function broadcast(
  type: BroadcastEvent,
  payload: Record<string, unknown>,
  tenantId?: string,
  userId?: string,
) {
  try {
    const secret = process.env.REALTIME_SECRET
    if (!secret || (!tenantId && !userId)) throw new Error('Realtime secret and target are required')
    const response = await fetch(`${WS_BRIDGE_URL}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({ type, payload, tenantId, userId }),
    })
    if (!response.ok) throw new Error(`Realtime bridge returned ${response.status}`)
  } catch (error) {
    console.error('[realtime] Broadcast failed', { type, tenantId, userId, error: error instanceof Error ? error.message : String(error) })
  }
}



