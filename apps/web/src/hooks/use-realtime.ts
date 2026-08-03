'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface RealtimeEvent {
  type: string
  payload: Record<string, unknown>
  _ts: number
}

interface UseRealtimeReturn {
  connected: boolean
  lastEvent: RealtimeEvent | null
  subscribe: (eventTypes: string | string[]) => void
  onEvent: (eventType: string, handler: (event: RealtimeEvent) => void) => void
}

export function useRealtime(): UseRealtimeReturn {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef<Map<string, ((event: RealtimeEvent) => void)[]>>(new Map())
  const subsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Only connect in browser, not SSR
    if (typeof window === 'undefined') return

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Re-subscribe to any existing subscriptions after reconnect
      if (subsRef.current.size > 0) {
        socket.emit('subscribe', Array.from(subsRef.current))
      }
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    // Listen for all events and route to registered handlers
    socket.onAny((eventName: string, ...args: unknown[]) => {
      const payload = (args[0] as Record<string, unknown>) || {}
      const event: RealtimeEvent = {
        type: eventName,
        payload,
        _ts: (payload._ts as number) || Date.now(),
      }
      setLastEvent(event)

      // Call registered handlers for this event type
      const handlers = handlersRef.current.get(eventName)
      if (handlers) {
        handlers.forEach((handler) => handler(event))
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const subscribe = useCallback((eventTypes: string | string[]) => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
    types.forEach((t) => subsRef.current.add(t))
    socketRef.current?.emit('subscribe', types)
  }, [])

  const onEvent = useCallback((eventType: string, handler: (event: RealtimeEvent) => void) => {
    const handlers = handlersRef.current.get(eventType) || []
    handlers.push(handler)
    handlersRef.current.set(eventType, handlers)
  }, [])

  return { connected, lastEvent, subscribe, onEvent }
}


