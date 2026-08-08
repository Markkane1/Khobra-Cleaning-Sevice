import { isIP } from 'node:net'
import type { NextRequest } from 'next/server'

const supportedHeaders = new Set(['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'])

export function getClientIp(request: NextRequest): string {
  const configured = (process.env.TRUSTED_IP_HEADER || 'x-forwarded-for').toLowerCase()
  const header = supportedHeaders.has(configured) ? configured : 'x-forwarded-for'
  const candidate = request.headers.get(header)?.split(',')[0]?.trim().replace(/^\[|\]$/g, '')
  return candidate && candidate.length <= 45 && isIP(candidate) ? candidate : 'anonymous'
}
