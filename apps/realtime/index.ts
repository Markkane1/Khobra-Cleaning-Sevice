import { createServer } from 'http'
import { Server } from 'socket.io'
import crypto from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET
const REALTIME_SECRET = process.env.REALTIME_SECRET
if (!AUTH_SECRET || !REALTIME_SECRET) throw new Error('AUTH_SECRET and REALTIME_SECRET are required')

const events = new Set([
  'booking:created', 'booking:updated', 'booking:deleted', 'invoice:created', 'invoice:updated',
  'payment:created', 'payment:updated', 'complaint:created', 'complaint:updated', 'complaint:resolved',
  'employee:created', 'employee:updated', 'customer:created', 'customer:updated', 'service:created',
  'service:updated', 'attendance:created', 'attendance:updated', 'attendance:deleted',
  'dispatch:assigned', 'dispatch:updated', 'inventory:updated', 'payroll:updated',
])

function verifyToken(token: unknown) {
  try {
    if (typeof token !== 'string') return null
    const [header, data, signature, extra] = token.split('.')
    if (!header || !data || !signature || extra) return null
    const supplied = Buffer.from(signature)
    const expected = Buffer.from(crypto.createHmac('sha256', AUTH_SECRET!).update(`${header}.${data}`).digest('base64url'))
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (!payload.userId || !payload.tenantId || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null
    return { userId: String(payload.userId), tenantId: String(payload.tenantId) }
  } catch { return null }
}

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN?.split(',').map(value => value.trim()).filter(Boolean) || [],
    methods: ['GET', 'POST'],
  },
})

const PORT = Number(process.env.PORT) || 3003
// Track connected socket subscriptions
const socketRooms = new Map<string, { tenantId?: string; userId?: string }>()

io.use((socket, next) => {
  const session = verifyToken(socket.handshake.auth?.token || socket.handshake.query?.token)
  if (!session) return next(new Error('Unauthorized'))
  ;(socket as any).tenantId = session.tenantId
  ;(socket as any).userId = session.userId
  next()
})

io.on('connection', (socket) => {
  const tenantId = (socket as any).tenantId
  const userId = (socket as any).userId

  if (tenantId) {
    socket.join(`tenant:${tenantId}`)
  }
  if (userId) {
    socket.join(`user:${userId}`)
  }

  socketRooms.set(socket.id, { tenantId, userId })

  socket.on('disconnect', () => {
    socketRooms.delete(socket.id)
  })
})

// ---- HTTP bridge for API routes to trigger authenticated broadcasts ----
httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    const authHeader = req.headers['authorization'] || req.headers['x-internal-secret']
    const suppliedSecret = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader

    if (suppliedSecret !== REALTIME_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized broadcast request' }))
      return
    }

    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { type, payload, tenantId, userId } = JSON.parse(body)
        if (!events.has(type) || (!tenantId && !userId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Allowed type and tenantId or userId are required' }))
          return
        }

        const data = { ...payload, _ts: Date.now() }

        if (userId) {
          io.to(`user:${userId}`).emit(type, data)
        } else if (tenantId) {
          io.to(`tenant:${tenantId}`).emit(type, data)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, type, clientsNotified: io.engine.clientsCount }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', clients: io.engine.clientsCount, rooms: socketRooms.size }))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[realtime] Authenticated Socket.IO server running on port ${PORT}`)
})


