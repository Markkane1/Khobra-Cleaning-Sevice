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

export async function broadcast(type: BroadcastEvent, payload: Record<string, unknown>) {
  try {
    fetch(`${WS_BRIDGE_URL}/broadcast`, {
      method: 'POST',
      headers : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    }).catch(() => {
      // Silent fail — WebSocket service may not be running
    })
  } catch {
    // Silent fail
  }
}


