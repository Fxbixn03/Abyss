/** Small presentation helpers for the Chats feature. */
import type { TFunction } from 'i18next'
import type { ChatMessage } from '@/shared/types/chat'

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
