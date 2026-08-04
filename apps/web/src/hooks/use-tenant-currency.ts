'use client'

import { useQuery } from '@tanstack/react-query'

export function useTenantCurrency() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => fetch('/api/khobra-cleaning/settings').then(response => response.json()) })
  return data?.tenant?.currency || 'AED'
}
