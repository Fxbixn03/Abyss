import { useMemo, useState, type ReactNode } from 'react'
import type { ChatSessionMeta } from '@/shared/types/chat'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { formatMoney } from '@/shared/lib/cost'
import { cn } from '@/shared/lib/utils'
import {
  sessionCostUsd,
  totalTokens,
  type SessionSortKey,
} from '../lib/aggregate'

type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'jpy'

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
  currency: Currency
  onSort: (key: SessionSortKey) => void
  onOpen: (sessionId: string) => void
  /** Set of currently selected session ids. */
  selectedIds?: Set<string>
  /** Toggle a single row's selected state. */
  onToggle?: (sessionId: string) => void
  /** Shift-click: select the range from last-toggled index to this one. */
  onToggleRange?: (fromIndex: number, toIndex: number) => void
  /** Render sessions grouped under collapsible per-project headers. */
  groupByProject?: boolean
}

export function SessionTable({
  sessions,
  sortKey,
  sortDir,
  currency,
  onSort,
  onOpen,
  selectedIds,
  onToggle,
  onToggleRange,
  groupByProject,
}: SessionTableProps) {
  const allSelected =
    sessions.length > 0 && sessions.every((s) => selectedIds?.has(s.id))
  const someSelected =
    !allSelected && sessions.some((s) => selectedIds?.has(s.id))

  const handleHeaderCheckbox = () => {
    if (!onToggle) return
    if (allSelected) {
      sessions.forEach((s) => onToggle(s.id))
    } else {
      sessions.forEach((s) => {
        if (!selectedIds?.has(s.id)) onToggle(s.id)
      })
    }
  }

  // Group sessions under their project label, preserving the incoming sort order
  // inside each group and ordering groups by most-recent activity.
  const groups = useMemo(() => {
    if (!groupByProject) return null
    const byProject = new Map<string, ChatSessionMeta[]>()
    for (const s of sessions) {
      const list = byProject.get(s.projectLabel) ?? []
      list.push(s)
      byProject.set(s.projectLabel, list)
    }
    const recency = (s: ChatSessionMeta) =>
      new Date(s.updatedAt ?? s.startedAt ?? 0).getTime()
    return [...byProject.entries()].sort(
      ([, a], [, b]) =>
        Math.max(...b.map(recency)) - Math.max(...a.map(recency)),
    )
  }, [groupByProject, sessions])

  // Default-collapse groups only when there are many of them (>3). `overridden`
  // holds the labels the user has flipped away from that default.
  const manyGroups = (groups?.length ?? 0) > 3
  const [overridden, setOverridden] = useState<Set<string>>(new Set())
  const isCollapsed = (label: string) =>
    overridden.has(label) ? !manyGroups : manyGroups
  const toggleGroup = (label: string) => {
    setOverridden((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const colCount = (onToggle ? 1 : 0) + 1 + COLUMNS.length

  const renderRow = (s: ChatSessionMeta, idx: number) => {
    const isSelected = selectedIds?.has(s.id) ?? false
    return (
      <tr
        key={s.id}
        onClick={() => onOpen(s.id)}
        className={cn(
          'cursor-pointer border-b border-border/60 hover:bg-muted/40',
          isSelected && 'bg-accent/50',
        )}
      >
        {onToggle && (
          <td className="w-8 px-3 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (e.shiftKey && onToggleRange) {
                  let anchor = -1
                  for (let i = idx - 1; i >= 0; i--) {
                    if (selectedIds?.has(sessions[i]!.id)) {
                      anchor = i
                      break
                    }
                  }
                  if (anchor === -1) {
                    for (let i = idx + 1; i < sessions.length; i++) {
                      if (selectedIds?.has(sessions[i]!.id)) {
                        anchor = i
                        break
                      }
                    }
                  }
                  if (anchor !== -1) {
                    onToggleRange(Math.min(anchor, idx), Math.max(anchor, idx))
                  } else {
                    onToggle(s.id)
                  }
                } else {
                  onToggle(s.id)
                }
              }}
              aria-label={isSelected ? 'Deselect session' : 'Select session'}
              className={cn(
                'flex size-4 items-center justify-center rounded border transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/60',
              )}
            >
              {isSelected && <Icon name="check" className="size-3" />}
            </button>
          </td>
        )}
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
        <td className="px-3 py-2 text-right tabular-nums">{s.messageCount}</td>
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
    )
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="border-b border-border text-xs text-muted-foreground">
          {onToggle && (
            <th className="w-8 px-3 py-2">
              <button
                type="button"
                onClick={handleHeaderCheckbox}
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
                className={cn(
                  'flex size-4 items-center justify-center rounded border transition-colors',
                  allSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : someSelected
                      ? 'border-primary bg-primary/30'
                      : 'border-border hover:border-primary/60',
                )}
              >
                {allSelected && <Icon name="check" className="size-3" />}
                {someSelected && (
                  <Icon name="minus" className="size-3 text-primary" />
                )}
              </button>
            </th>
          )}
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
        {groups
          ? groups.map(([label, items]) => {
              const groupTokens = items.reduce(
                (sum, s) => sum + totalTokens(s),
                0,
              )
              const groupCost = items.reduce(
                (sum, s) => sum + sessionCostUsd(s),
                0,
              )
              const open = !isCollapsed(label)
              return (
                <GroupRows
                  key={label}
                  label={label}
                  count={items.length}
                  tokens={groupTokens}
                  cost={groupCost}
                  currency={currency}
                  colCount={colCount}
                  open={open}
                  onToggle={() => toggleGroup(label)}
                >
                  {items.map((s) =>
                    renderRow(s, sessions.indexOf(s)),
                  )}
                </GroupRows>
              )
            })
          : sessions.map((s, idx) => renderRow(s, idx))}
      </tbody>
    </table>
  )
}

/** A collapsible project group: a header row plus its session rows. */
function GroupRows({
  label,
  count,
  tokens,
  cost,
  currency,
  colCount,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  tokens: number
  cost: number
  currency: Currency
  colCount: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <>
      <tr className="border-b border-border bg-muted/30">
        <td colSpan={colCount} className="px-3 py-1.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left text-xs font-medium"
          >
            <Icon
              name={open ? 'chevron-down' : 'chevron-right'}
              className="size-3.5 text-muted-foreground"
            />
            <Icon name="folder" className="size-3.5 text-muted-foreground" />
            <span className="truncate">{label}</span>
            <span className="text-muted-foreground">
              · {count} session{count === 1 ? '' : 's'} · ~{compact(tokens)}{' '}
              tokens · ~{formatMoney(cost, currency)}
            </span>
          </button>
        </td>
      </tr>
      {open && children}
    </>
  )
}
