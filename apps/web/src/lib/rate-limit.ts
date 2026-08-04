// ponytail: lightweight in-memory sliding window rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit = 20, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateMap.get(key)

  if (!record || now > record.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  record.count += 1
  return { allowed: true, remaining: limit - record.count }
}

// Cleanup stale keys periodically to avoid memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of rateMap.entries()) {
      if (now > v.resetAt) rateMap.delete(k)
    }
  }, 300_000)
}
