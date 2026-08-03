import { useState, useMemo, useCallback } from 'react'

export type SortDir = 'asc' | 'desc' | null

export function useSortable<T>(data: T[], defaultKey?: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const toggle = useCallback((key: keyof T) => {
    setSortDir(prev => {
      if (sortKey === key) {
        if (prev === 'asc') return 'desc'
        if (prev === 'desc') return null
      }
      setSortKey(key)
      return 'asc'
    })
  }, [sortKey])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [data, sortKey, sortDir])

  const SortableHeader = useCallback(({ col, children }: { col: keyof T, children: React.ReactNode }) => {
    const isActive = sortKey === col && sortDir
    return (
      <button
        type="button"
        onClick={() => toggle(col)}
        className={`inline-flex items-center gap-1 text-xs font-semibold hover:text-foreground transition-colors ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}
      >
        {children}
        <span className="text-[10px]">{isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }, [sortKey, sortDir, toggle])

  return { sorted, sortKey, sortDir, toggle, SortableHeader }
}


