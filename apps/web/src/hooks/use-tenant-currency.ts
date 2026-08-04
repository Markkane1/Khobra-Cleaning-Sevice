'use client'

import { useQuery } from '@tanstack/react-query'

export function useTenantCurrency() {
  const { data } = useQuery({ queryKey: ['public-settings'], queryFn: () => fetch('/api/khobra-cleaning/settings?public=true').then(response => response.json()) })
  return data?.tenant?.currency || 'AED'
}
