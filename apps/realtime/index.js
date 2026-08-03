import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  coAED : {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
  },
})

const PORT = 3003

// Track connected clients per subscription
const subscriptions = new Map() // socketId -> Set<eventType>

io.on('connection', (socket) => {
  console.log(`[realtime] Client connected: ${socket.id}`)
  subscriptions.set(socket.id, new Set())

  // Subscribe to specific event types
  socket.on('subscribe', (eventTypes) => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
    const subs = subscriptions.get(socket.id) || new Set()
    types.forEach((t) => subs.add(t))
    subscriptions.set(socket.id, subs)
    console.log(`[realtime] ${socket.id} subscribed to: ${types.join(', ')}`)
  })

  // Unsubscribe from specific event types
  socket.on('unsubscribe', (eventTypes) => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
    const subs = subscriptions.get(socket.id)
    if (subs) {
      types.forEach((t) => subs.delete(t))
    }
  })

  // Allow clients to broadcast events (e.g., from API routes)
  socket.on('broadcast', (event) => {
    const { type, payload } = event
    console.log(`[realtime] Broadcasting: ${type}`)
    io.emit(type, { ...payload, _ts: Date.now() })
  })

  socket.on('disconnect', (reason) => {
    console.log(`[realtime] Client disconnected: ${socket.id} (${reason})`)
    subscriptions.delete(socket.id)
  })
})

// --- Demo event emitteAED (simulate data changes) ---
// In production, API routes would call io.emit() directly

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

const sampleEvents = [
  {
    type: 'booking:updated',
    generate: () => ({
      message: `Booking #BK-${String(Math.floor(Math.random() * 900) + 100)} ${randomItem(['completed', 'confirmed', 'in_progress'])}`,
      bookingNo: `BK-${String(Math.floor(Math.random() * 900) + 100)}`,
      status: randomItem(['completed', 'confirmed', 'in_progress']),
    }),
  },
  {
    type: 'invoice:created',
    generate: () => ({
      message: `Payment AED ${((Math.floor(Math.random() * 50) + 1) * 1000).toLocaleString()} received`,
      amount: (Math.floor(Math.random() * 50) + 1) * 1000,
    }),
  },
  {
    type: 'complaint:resolved',
    generate: () => ({
      message: `Complaint #CMP-${String(Math.floor(Math.random() * 900) + 100)} resolved`,
      complaintNo: `CMP-${String(Math.floor(Math.random() * 900) + 100)}`,
    }),
  },
  {
    type: 'dispatch:assigned',
    generate: () => ({
      message: `Driver assigned to booking #BK-${String(Math.floor(Math.random() * 900) + 100)}`,
    }),
  },
]

// Emit a demo event every 15-30 seconds
function emitDemoEvent() {
  const sample = randomItem(sampleEvents)
  const payload = sample.generate()
  console.log(`[realtime] Demo event: ${sample.type} - ${payload.message}`)
  io.emit(sample.type, { ...payload, _ts: Date.now() })

  const nextDelay = 15000 + Math.random() * 15000
  setTimeout(emitDemoEvent, nextDelay)
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[realtime] Socket.IO server running on port ${PORT}`)
  // Start demo events after 5 seconds
  setTimeout(emitDemoEvent, 5000)
})

