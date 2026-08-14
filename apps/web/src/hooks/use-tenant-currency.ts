'use client'

import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api-client'

export function useTenantCurrency() {
  const { data } = useQuery({ queryKey: ['public-settings'], queryFn: () => apiRequest<any>('/api/khobra-cleaning/public/services') })
  return data?.business?.currency || 'AED'
}
