'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtime } from '@/hooks/use-realtime'

type LiveEvent = {
  id: string
  message: string
  type: string
  timestamp: number
}

const EVENT_TTL = 8000
const MAX_EVENTS = 5

const eventColors : Record<string, string> = {
  'booking:updated': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'invoice:created': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  'complaint:resolved': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  'dispatch:assigned': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
}

function getEventColor(type: string): string {
  return eventColors [type] || 'bg-muted text-muted-foreground border-border'
}

function extractMessage(event: { type: string; payload: Record<string, unknown> }): string {
  const p = event.payload
  if (typeof p.message === 'string' && p.message) return p.message
  switch (event.type) {
    case 'booking:updated':
      return `Booking #${p.bookingNo || '???'} updated`
    case 'invoice:created':
      return `Invoice #${p.invoiceNo || '???'} created`
    case 'complaint:resolved':
      return `Complaint #${p.complaintNo || '???'} resolved`
    default:
      return event.type.replace(/:/g, ' ')
  }
}

export function LiveEventsBar() {
  const { connected, subscribe, onEvent } = useRealtime()
  const [events, setEvents] = useState<LiveEvent[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const eventsRef = useRef<LiveEvent[]>([])
  const setEventsRef = useRef(setEvents)
  useEffect(() => { setEventsRef.current = setEvents }, [setEvents])

  const handleEvent = useCallback((event: { type: string; payload: Record<string, unknown>; _ts: number }) => {
    const id = `${event.type}-${event._ts}`
    const newEvent: LiveEvent = {
      id,
      message: extractMessage(event),
      type: event.type,
      timestamp: event._ts,
    }

    if (eventsRef.current.some((e) => e.id === id)) return

    const next = [newEvent, ...eventsRef.current].slice(0, MAX_EVENTS)
    eventsRef.current = next
    setEventsRef.current(next)

    const timer = setTimeout(() => {
      eventsRef.current = eventsRef.current.filter((e) => e.id !== id)
      setEventsRef.current([...eventsRef.current])
      timersRef.current.delete(id)
    }, EVENT_TTL)
    timersRef.current.set(id, timer)
  }, [])

  useEffect(() => {
    subscribe(['booking:updated', 'invoice:created', 'complaint:resolved', 'dispatch:assigned'])
  }, [subscribe])

  useEffect(() => {
    onEvent('booking:updated', handleEvent)
    onEvent('invoice:created', handleEvent)
    onEvent('complaint:resolved', handleEvent)
    onEvent('dispatch:assigned', handleEvent)
  }, [onEvent, handleEvent])

  if (!connected && events.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 h-8 bg-muted/30 border-b">
        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Connecting to live updates...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 h-8 bg-muted/20 border-b overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-400'}`} />
        <span className="text-[11px] text-muted-foreground font-medium">Live</span>
      </div>

      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.span
              key={event.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${getEventColor(event.type)}`}
            >
              {event.message}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}


