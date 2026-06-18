/**
 * Pure sort/group helpers for the session list.
 * No React, no IPC, no DOM — fully unit-testable.
 */

import type { ChatSessionMeta } from '@/shared/types/chat'

export type SortOrder = 'recent' | 'longest' | 'costliest'
export type GroupBy = 'project' | 'date'

/**
 * Returns the sessions whose title, projectLabel, or cwd contain `query`
 * (case-insensitive substring match). An empty or blank query returns all
 * sessions unchanged (same array reference).
 */
export function filterSessions(
  sessions: ChatSessionMeta[],
  query: string,
): ChatSessionMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return sessions
  return sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.projectLabel.toLowerCase().includes(q) ||
      s.cwd.toLowerCase().includes(q),
  )
}

/**
 * Returns a sorted copy of `sessions` according to `sort`.
 * 'recent' preserves the original (already-recency-ordered) sequence.
 */
export function sortSessions(
  sessions: ChatSessionMeta[],
  sort: SortOrder,
): ChatSessionMeta[] {
  if (sort === 'recent') return sessions
  const copy = [...sessions]
  if (sort === 'longest') {
    copy.sort((a, b) => b.messageCount - a.messageCount)
  } else {
    // costliest: descending outputTokens, falling back to inputTokens
    copy.sort((a, b) => {
      const costA = (a.outputTokens ?? 0) || (a.inputTokens ?? 0)
      const costB = (b.outputTokens ?? 0) || (b.inputTokens ?? 0)
      return costB - costA
    })
  }
  return copy
}

export type DateBucketKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older'

/** Human-readable label for each date bucket (for tests and the UI). */
export const DATE_BUCKET_LABELS: Record<DateBucketKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',
  older: 'Older',
}

/** Canonical rendering order for date buckets (newest first). */
export const DATE_BUCKET_KEY_ORDER: DateBucketKey[] = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'older',
]

/**
 * Returns the date-bucket key for a given timestamp.
 * Weeks start on Monday.
 */
export function dateBucket(
  updatedAt: string | number | Date | undefined,
): DateBucketKey {
  const now = new Date()
  const date = updatedAt != null ? new Date(updatedAt) : new Date(0)

  // Start of today (midnight local time)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Start of yesterday
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  // Start of this week (Monday = day 1; Sunday = 0 → shift to last Monday)
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, …, 6=Sat
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - daysToMonday)
  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  if (date >= startOfToday) return 'today'
  if (date >= startOfYesterday) return 'yesterday'
  if (date >= startOfWeek) return 'thisWeek'
  if (date >= startOfMonth) return 'thisMonth'
  return 'older'
}

/**
 * Groups `sessions` into `[label, items]` pairs.
 * Pinned sessions float to the top within each group.
 * For `groupBy='date'` the label is a `DateBucketKey`; empty buckets are omitted.
 * For `groupBy='project'` the label is the raw `projectLabel` string.
 */
export function groupSessions(
  sessions: ChatSessionMeta[],
  groupBy: GroupBy,
  pinnedIds: Set<string>,
): [string, ChatSessionMeta[]][] {
  /** Sort pinned sessions to the top within a group, preserving relative order. */
  const sortGroupItems = (items: ChatSessionMeta[]): ChatSessionMeta[] => {
    if (pinnedIds.size === 0) return items
    const pinned = items.filter((s) => pinnedIds.has(s.id))
    const unpinned = items.filter((s) => !pinnedIds.has(s.id))
    return [...pinned, ...unpinned]
  }

  if (groupBy === 'project') {
    const byProject = new Map<string, ChatSessionMeta[]>()
    for (const s of sessions) {
      const list = byProject.get(s.projectLabel) ?? []
      list.push(s)
      byProject.set(s.projectLabel, list)
    }
    return [...byProject.entries()].map(([label, items]) => [
      label,
      sortGroupItems(items),
    ])
  }

  // date grouping — use keys instead of translated strings
  const byDate = new Map<DateBucketKey, ChatSessionMeta[]>()
  for (const s of sessions) {
    const bucket = dateBucket(s.updatedAt)
    const list = byDate.get(bucket) ?? []
    list.push(s)
    byDate.set(bucket, list)
  }
  // Return in canonical order, omitting empty buckets
  return DATE_BUCKET_KEY_ORDER.filter((key) => byDate.has(key)).map(
    (key) => [key, sortGroupItems(byDate.get(key) ?? [])],
  )
}
