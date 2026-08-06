import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'

const safeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-')

export async function downloadBlob(blob: Blob, filename: string) {
  const name = safeFilename(filename)
  if (Capacitor.isNativePlatform()) {
    const [{ Directory, Filesystem }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error || new Error('Could not read export file'))
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
      reader.readAsDataURL(blob)
    })
    const file = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, recursive: true })
    await Share.share({ title: name, files: [file.uri], dialogTitle: `Save or share ${name}` })
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  void downloadBlob(blob, `${filename}.csv`).catch(error => {
    console.error('CSV export failed', error)
    toast.error('CSV export failed')
  })
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

