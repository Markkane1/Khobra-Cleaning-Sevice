const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
export const apiBaseUrl = validApiOrigin(configuredApiBaseUrl)
let unauthorizedHandler: (() => void | Promise<void>) | undefined

function validApiOrigin(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return (__DEV__ || url.protocol === 'https:') && url.origin === value ? value : undefined
  } catch {
    return undefined
  }
}

export function setUnauthorizedHandler(handler?: () => void | Promise<void>) {
  unauthorizedHandler = handler
}

function apiUrl(path: string) {
  if (!apiBaseUrl) throw new Error('Set EXPO_PUBLIC_API_URL in apps/mobile/.env.')
  return `${apiBaseUrl}${path}`
}

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetchWithTimeout(apiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  const body = await response.json().catch(() => null)
  if (response.status === 401) await unauthorizedHandler?.()
  if (!response.ok) throw new Error(body?.error || 'The server could not complete the request.')
  return body as T
}

export async function upload(path: string, form: FormData, token: string): Promise<any> {
  const response = await fetchWithTimeout(apiUrl(path), { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, body: form })
  const body = await response.json().catch(() => null)
  if (response.status === 401) await unauthorizedHandler?.()
  if (!response.ok) throw new Error(body?.error || 'The upload could not be completed.')
  return body
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The request timed out. Check your connection and try again.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
