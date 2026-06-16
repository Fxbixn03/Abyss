import type { AppSettings } from '@/shared/types/config'

export type DateTimeFormat = AppSettings['dateTimeFormat']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Render an absolute date/time according to the user's chosen format. Relative
 * displays ("3m ago") are unaffected — this is for absolute timestamps only.
 */
export function formatDateTime(
  value: string | number | Date,
  format: DateTimeFormat = 'locale',
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  switch (format) {
    case 'iso':
      return `${Y}-${M}-${D} ${h}:${m}`
    case 'us':
      return `${M}/${D}/${Y} ${h}:${m}`
    case 'eu':
      return `${D}.${M}.${Y} ${h}:${m}`
    case 'locale':
    default:
      return d.toLocaleString()
  }
}
