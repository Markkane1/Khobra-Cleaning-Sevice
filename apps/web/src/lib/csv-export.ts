/**
 * Export data as CSV file download
 */
export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (!data.length) return

  const keys = columns
    ? columns.map(c => c.label)
    : Object.keys(data[0])

  const accessors = columns
    ? columns.map(c => c.key)
    : Object.keys(data[0])

  const header = keys.join(',')
  const rows = data.map(row =>
    accessors.map(key => {
      const val = row[key]
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
      // Escape quotes and wrap in quotes if contains comma/newline/quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;chars et=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Format a date string for CSV export
 */
export function csvDate(d: string | null | undefined): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString() } catch { return d }
}

/**
 * Format currency for CSV export
 */
export function csvCurrency(amount: number | null | undefined): string {
  if (amount == null) return '0'
  return amount.toLocaleString()
}

