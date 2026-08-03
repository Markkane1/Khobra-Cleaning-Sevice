import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
  },
})

const PORT = 3003

// Track connected clients
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

  socket.on('disconnect', (reason) => {
    console.log(`[realtime] Client disconnected: ${socket.id} (${reason})`)
    subscriptions.delete(socket.id)
  })
})

// ---- HTTP bridge for API routes to trigger broadcasts ----
// API routes call this endpoint to broadcast real-time events
httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { type, payload } = JSON.parse(body)
        if (!type) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'type is required' }))
          return
        }
        console.log(`[realtime] HTTP broadcast: ${type}`, payload ? JSON.stringify(payload).slice(0, 100) : '')
        io.emit(type, { ...payload, _ts: Date.now() })
        const connectedClients = io.engine.clientsCount
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, type, clientsNotified: connectedClients }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', clients: io.engine.clientsCount, subscriptions: subscriptions.size }))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[realtime] Socket.IO + HTTP bridge server running on port ${PORT}`)
  console.log(`[realtime] POST /broadcast  - trigger real-time events from API routes`)
  console.log(`[realtime] GET  /health     - service health check`)
})

