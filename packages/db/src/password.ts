import crypto from 'crypto'

export function hashPassword(password: string) {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')
  const salt = crypto.randomBytes(16).toString('hex')
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string) {
  try {
    const [scheme, salt, encoded] = storedHash.split('$')
    if (scheme !== 'scrypt' || !salt || !encoded) return false
    const actual = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(encoded, 'hex')
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch { return false }
}
