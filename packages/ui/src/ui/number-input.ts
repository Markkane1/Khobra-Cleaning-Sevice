export function integerBounds(min?: number | string, max?: number | string) {
  const parsedMin = Number(min)
  const parsedMax = Number(max)
  const safeMin = Math.max(0, Number.isFinite(parsedMin) ? Math.ceil(parsedMin) : 0)
  return {
    min: safeMin,
    max: Number.isFinite(parsedMax) ? Math.max(safeMin, Math.floor(parsedMax)) : Number.POSITIVE_INFINITY,
  }
}

export function normalizeInteger(value: unknown, min?: number | string, max?: number | string) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const bounds = integerBounds(min, max)
  return Math.min(bounds.max, Math.max(bounds.min, Math.trunc(parsed)))
}

export function stepInteger(value: unknown, direction: -1 | 1, min?: number | string, max?: number | string) {
  const bounds = integerBounds(min, max)
  const current = normalizeInteger(value, min, max) ?? bounds.min
  return Math.min(bounds.max, Math.max(bounds.min, current + direction))
}
