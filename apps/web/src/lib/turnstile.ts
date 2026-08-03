const TEST_SECRET = '1x0000000000000000000000000000000AA'

export async function verifyTurnstile(token: unknown, remoteIp?: string): Promise<boolean> {
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const secret = process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : TEST_SECRET)
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY must be configured in production.')

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  if (!response.ok) return false
  return Boolean((await response.json() as { success?: boolean }).success)
}
