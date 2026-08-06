'use client'

import { useQuery } from '@tanstack/react-query'

export function useTenantCurrency() {
  const { data } = useQuery({ queryKey: ['public-settings'], queryFn: () => fetch('/api/khobra-cleaning/public/services').then(response => response.json()) })
  return data?.business?.currency || 'AED'
}
