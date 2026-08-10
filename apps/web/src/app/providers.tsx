'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        retry: 1,
      },
    },
  }))

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window)

    const checkedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await nativeFetch(input, init)
      if (response.ok) return response

      if (response.status === 401) {
        queryClient.clear()
        useAppStore.getState().logout()
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          window.history.replaceState(null, '', '/login')
        }
      }

      const body = await response.clone().json().catch(() => null)
      const issueMessage = body?.issues?.map((issue: { message?: string }) => issue.message).filter(Boolean).join(' ')
      throw new Error(issueMessage || body?.error || `Request failed (${response.status})`)
    }) as typeof window.fetch
    window.fetch = Object.assign(checkedFetch, nativeFetch)

    return () => { window.fetch = nativeFetch }
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

