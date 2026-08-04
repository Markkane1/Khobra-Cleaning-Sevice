export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
let unauthorizedHandler: (() => void | Promise<void>) | undefined

export function setUnauthorizedHandler(handler?: () => void | Promise<void>) {
  unauthorizedHandler = handler
}

function apiUrl(path: string) {
  if (!apiBaseUrl) throw new Error('Set EXPO_PUBLIC_API_URL in apps/mobile/.env.')
  return `${apiBaseUrl}${path}`
}

export async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
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
  const response = await fetch(apiUrl(path), { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, body: form })
  const body = await response.json().catch(() => null)
  if (response.status === 401) await unauthorizedHandler?.()
  if (!response.ok) throw new Error(body?.error || 'The upload could not be completed.')
  return body
}
