import crypto from 'crypto'

export type RoleId = 'admin' | 'customer' | 'cleaner' | 'driver' | (string & {})

const AUTH_SECRET = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'khobra-development-secret')
export const SESSION_TTL_SECONDS = 8 * 60 * 60

export interface UserSession {
  userId: string
  tenantId: string
  email: string
  role: RoleId
  name: string
  sessionVersion?: number
}

export interface VerifiedSession extends UserSession {
  expiresAt: number
}

export function createSessionToken(
  payload: UserSession,
  expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
): string {
  if (!AUTH_SECRET) throw new Error('AUTH_SECRET must be configured in production.')
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const data = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt })).toString('base64url')
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${data}`).digest('base64url')
  return `${header}.${data}.${signature}`
}

export function verifySessionToken(token: string): VerifiedSession | null {
  try {
    if (!AUTH_SECRET) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, data, signature] = parts
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${data}`).digest('base64url')
    const supplied = Buffer.from(signature)
    const expected = Buffer.from(expectedSig)
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'))
    if (payload.role === 'employee') payload.role = 'cleaner'
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null
    if (![payload.userId, payload.tenantId, payload.email, payload.role, payload.name].every((value) => typeof value === 'string' && value)) return null
    if (payload.sessionVersion !== undefined && (!Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 0)) return null
    return { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, role: payload.role, name: payload.name, sessionVersion: payload.sessionVersion ?? 0, expiresAt: payload.exp * 1000 }
  } catch {
    return null
  }
}

export function hashPassword(password: string): string {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')
  const salt = crypto.randomBytes(16).toString('hex')
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [scheme, salt, encoded] = storedHash.split('$')
    if (scheme !== 'scrypt' || !salt || !encoded) return false
    const actual = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(encoded, 'hex')
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
