/** Small presentation helpers for the Chats feature. */
import type { TFunction } from 'i18next'
import type { ChatMessage } from '@/shared/types/chat'

/**
 * Wrap every case-insensitive occurrence of `query` inside `html` with a
 * `<mark>` element, but only in text nodes — never inside tag attributes or
 * tag names.  The regex splits the string into alternating tag / text chunks
 * and only replaces within the text chunks.
 *
 * Returns `html` unchanged when `query` is empty or blank.
 */
export function highlightText(html: string, query: string): string {
  const q = query.trim()
  if (!q) return html

  // Split HTML into an alternating sequence: text, tag, text, tag, …
  // The capturing group keeps the tags in the result array.
  const parts = html.split(/(<[^>]*>)/g)
  const re = new RegExp(
    q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'gi',
  )

  return parts
    .map((part) => {
      // Tags start with '<' — leave them untouched.
      if (part.startsWith('<')) return part
      return part.replace(re, (match) => `<mark class="highlight-match">${match}</mark>`)
    })
    .join('')
}

export function relativeTime(iso: string | undefined, t: TFunction<'chats'>): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return t('relativeTime.justNow')
  if (min < 60) return t('relativeTime.minutesAgo', { count: min })
  const hours = Math.round(min / 60)
  if (hours < 24) return t('relativeTime.hoursAgo', { count: hours })
  const days = Math.round(hours / 24)
  if (days < 30) return t('relativeTime.daysAgo', { count: days })
  return new Date(iso).toLocaleDateString()
}

/**
 * Forward-looking duration until a reset timestamp, e.g. "Resets in 3h 30m".
 * Returns the "resets now" string once the window has elapsed.
 */
export function formatResetIn(
  iso: string | undefined,
  t: TFunction<'chats'>,
): string {
  if (!iso) return ''
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return ''
  const min = Math.round((target - Date.now()) / 60000)
  if (min <= 0) return t('planUsage.resetsNow')
  const hours = Math.floor(min / 60)
  const minutes = min % 60
  if (hours >= 24) {
    const days = Math.round(hours / 24)
    return t('planUsage.resetsInDays', { count: days })
  }
  if (hours > 0) return t('planUsage.resetsInHm', { hours, minutes })
  return t('planUsage.resetsInM', { minutes })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCost(usd?: number): string {
  if (usd == null) return ''
  return `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`
}

/** Extract all plain text from a message's text blocks, joined with a space. */
export function extractMessageText(message: ChatMessage): string {
  return message.blocks
    .filter((b): b is Extract<typeof b, { kind: 'text' }> => b.kind === 'text')
    .map((b) => b.text)
    .join(' ')
}
