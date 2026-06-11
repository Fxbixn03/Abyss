import type { ChatSessionMeta } from '@/shared/types/chat'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { formatMoney } from '@/shared/lib/cost'
import {
  sessionCostUsd,
  totalTokens,
  type SessionSortKey,
} from '../lib/aggregate'

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function relativeTime(iso?: string): string {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

interface Column {
  key: SessionSortKey
  label: string
  align: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { key: 'project', label: 'Project', align: 'left' },
  { key: 'messages', label: 'Msgs', align: 'right' },
  { key: 'tokens', label: 'Tokens', align: 'right' },
  { key: 'cost', label: 'Est. cost', align: 'right' },
  { key: 'updatedAt', label: 'Updated', align: 'right' },
]

export interface SessionTableProps {
  sessions: ChatSessionMeta[]
  sortKey: SessionSortKey
  sortDir: 'asc' | 'desc'
  currency: 'usd' | 'eur'
  onSort: (key: SessionSortKey) => void
  onOpen: (sessionId: string) => void
}

export function SessionTable({
  sessions,
  sortKey,
  sortDir,
  currency,
  onSort,
  onOpen,
}: SessionTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th className="px-3 py-2 text-left font-medium">Title</th>
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              className={`px-3 py-2 font-medium ${
                col.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              <button
                type="button"
                onClick={() => onSort(col.key)}
                className={`inline-flex items-center gap-1 hover:text-foreground ${
                  col.align === 'right' ? 'flex-row-reverse' : ''
                }`}
              >
                {col.label}
                {sortKey === col.key && (
                  <Icon
                    name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}
                    className="size-3"
                  />
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
          >
            <td className="max-w-0 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate" title={s.title}>
                  {s.title || 'Untitled session'}
                </span>
                {s.gitBranch && (
                  <Badge variant="muted" className="shrink-0 font-code">
                    <Icon name="git-branch" className="size-3" />
                    {s.gitBranch}
                  </Badge>
                )}
              </div>
            </td>
            <td className="px-3 py-2 text-left">
              <span className="truncate font-code text-xs text-muted-foreground">
                {s.projectLabel}
              </span>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {s.messageCount}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {compact(totalTokens(s))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
              ~{formatMoney(sessionCostUsd(s), currency)}
            </td>
            <td className="px-3 py-2 text-right text-xs text-muted-foreground">
              {relativeTime(s.updatedAt ?? s.startedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
