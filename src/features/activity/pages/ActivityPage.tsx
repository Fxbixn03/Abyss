import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SnapshotMeta } from '@/shared/types/snapshots'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { LineDiffView } from '@/shared/components/LineDiffView'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { cn } from '@/shared/lib/utils'

type RelTime =
  | { kind: 'key'; key: 'relative.now' | 'relative.minutes' | 'relative.hours'; count: number }
  | { kind: 'literal'; text: string }

function relativeTime(iso: string): RelTime {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return { kind: 'literal', text: '' }
  const min = Math.round((Date.now() - then) / 60000)
  if (min < 1) return { kind: 'key', key: 'relative.now', count: 0 }
  if (min < 60) return { kind: 'key', key: 'relative.minutes', count: min }
  const hours = Math.round(min / 60)
  if (hours < 24) return { kind: 'key', key: 'relative.hours', count: hours }
  return {
    kind: 'literal',
    text: new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Stable day-bucket token for grouping: '@today' / '@yesterday' / a locale date. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (same(d, today)) return '@today'
  if (same(d, yesterday)) return '@yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

type DateRange = '7d' | '30d' | 'all'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
]

/** Earliest timestamp (ms) to include for the given range, or null for 'all'. */
function rangeCutoffMs(range: DateRange): number | null {
  if (range === 'all') return null
  return Date.now() - (range === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
}

/** Returns the AgentId whose config base path is a prefix of the given path, or null. */
function agentIdForPath(
  originalPath: string,
  agentBasePaths: Record<string, string[]>,
): string | null {
  const lower = originalPath.toLowerCase()
  for (const [agentId, bases] of Object.entries(agentBasePaths)) {
    for (const base of bases) {
      if (base && lower.startsWith(base.toLowerCase())) return agentId
    }
  }
  return null
}

interface DiffState {
  previous: string
  current: string | null
  loading: boolean
}

export function ActivityPage() {
  const { t } = useTranslation('activity')
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('')
  const [range, setRange] = useState<DateRange>('all')
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [expanded, setExpanded] = useState<Record<string, DiffState>>({})
  const [confirmUndo, setConfirmUndo] = useState<SnapshotMeta | null>(null)

  const settingsDetected = useSettingsStore((s) => s.detected)
  const settingsAgentPaths = useSettingsStore((s) => s.settings.agentPaths)

  // Build agentId -> [basePath, ...] from explicit overrides and detected paths.
  const agentBasePaths = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {}
    for (const adapter of agentRegistry.getAll()) {
      const bases: string[] = []
      const explicit = settingsAgentPaths[adapter.id]
      if (explicit && explicit.trim() !== '') bases.push(explicit.trim())
      for (const det of settingsDetected[adapter.id] ?? []) {
        if (det.path && !bases.includes(det.path)) bases.push(det.path)
      }
      result[adapter.id] = bases
    }
    return result
  }, [settingsDetected, settingsAgentPaths])

  const refresh = async () => {
    const list = await ipc.listRecentSnapshots(300)
    setSnapshots(list)
    setLoaded(true)
  }

  useEffect(() => {
    let active = true
    void ipc.listRecentSnapshots(300).then((list) => {
      if (!active) return
      setSnapshots(list)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  // Derive the set of agent ids that actually appear in the current snapshots.
  const presentAgentIds = useMemo<string[]>(() => {
    const seen = new Set<string>()
    for (const s of snapshots) {
      const id = agentIdForPath(s.originalPath, agentBasePaths)
      if (id) seen.add(id)
    }
    return [...seen]
  }, [snapshots, agentBasePaths])

  const filtered = useMemo(() => {
    const cutoff = rangeCutoffMs(range)
    const q = filter.trim().toLowerCase()

    return snapshots.filter((s) => {
      if (cutoff !== null && new Date(s.timestamp).getTime() < cutoff)
        return false
      if (
        selectedAgent !== 'all' &&
        agentIdForPath(s.originalPath, agentBasePaths) !== selectedAgent
      )
        return false
      if (
        q &&
        !s.fileName.toLowerCase().includes(q) &&
        !s.originalPath.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [snapshots, filter, range, selectedAgent, agentBasePaths])

  // Group the (already newest-first) list into day buckets, preserving order.
  const groups = useMemo(() => {
    const out: { label: string; items: SnapshotMeta[] }[] = []
    for (const s of filtered) {
      const label = dayLabel(s.timestamp)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(s)
      else out.push({ label, items: [s] })
    }
    return out
  }, [filtered])

  const toggleDiff = async (snap: SnapshotMeta) => {
    if (expanded[snap.id]) {
      setExpanded((e) => {
        const next = { ...e }
        delete next[snap.id]
        return next
      })
      return
    }
    setExpanded((e) => ({
      ...e,
      [snap.id]: { previous: '', current: null, loading: true },
    }))
    try {
      const [content, live] = await Promise.all([
        ipc.readSnapshot(snap.id),
        ipc.snapshotCurrent(snap.id),
      ])
      setExpanded((e) => ({
        ...e,
        [snap.id]: {
          previous: content?.content ?? '',
          current: live.content,
          loading: false,
        },
      }))
    } catch (err) {
      setExpanded((e) => {
        const next = { ...e }
        delete next[snap.id]
        return next
      })
      reportError(err, { title: "Couldn't load the change" })
    }
  }

  const renderRel = (iso: string) => {
    const r = relativeTime(iso)
    return r.kind === 'literal' ? r.text : t(r.key, { count: r.count })
  }
  const renderDay = (label: string) =>
    label === '@today'
      ? t('day.today')
      : label === '@yesterday'
        ? t('day.yesterday')
        : label

  const undo = async (snap: SnapshotMeta) => {
    setConfirmUndo(null)
    try {
      const result = await ipc.restoreSnapshot(snap.id)
      if (result?.success) {
        setExpanded((e) => {
          const next = { ...e }
          delete next[snap.id]
          return next
        })
        await refresh()
      }
    } catch (err) {
      reportError(err, { title: "Couldn't undo the change" })
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon="scroll-text"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <Icon name="refresh-cw" />
            {t('actions.refresh')}
          </Button>
        }
      />

      {snapshots.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date-range segmented control */}
            <div className="flex rounded-md border border-border">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-[calc(theme(borderRadius.md)-1px)] last:rounded-r-[calc(theme(borderRadius.md)-1px)]',
                    range === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Agent filter — only shown when more than one agent has snapshots */}
            {presentAgentIds.length > 1 && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder={t('filters.allAgents')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allAgents')}</SelectItem>
                  {presentAgentIds.map((id) => {
                    const adapter = agentRegistry.has(id)
                      ? agentRegistry.get(id)
                      : null
                    return (
                      <SelectItem key={id} value={id}>
                        {adapter?.displayName ?? id}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('filters.file')}
              className="pl-9"
            />
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {loaded && snapshots.length === 0 ? (
          <EmptyState
            icon="scroll-text"
            title={t('empty.title')}
            description={t('empty.desc')}
          />
        ) : loaded && filtered.length === 0 ? (
          <EmptyState
            icon="search-x"
            title={t('noMatch.title')}
            description={t('noMatch.desc')}
          />
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">{t('actions.loading')}</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <h2 className="sticky top-0 bg-background/80 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                {renderDay(group.label)}
              </h2>
              {group.items.map((snap) => {
                const diff = expanded[snap.id]
                const unchanged =
                  diff && !diff.loading && diff.current === diff.previous
                return (
                  <div
                    key={snap.id}
                    className="rounded-lg border border-border bg-card/40"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Icon
                        name="file-pen-line"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {snap.fileName}
                        </p>
                        <p className="truncate font-code text-[11px] text-muted-foreground">
                          {snap.originalPath}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {formatBytes(snap.sizeBytes)}
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {renderRel(snap.timestamp)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleDiff(snap)}
                        >
                          <Icon name={diff ? 'chevron-up' : 'git-compare'} />
                          {t('actions.diff')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void ipc.revealPath(snap.originalPath)}
                          title={t('actions.reveal')}
                        >
                          <Icon name="folder-open" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmUndo(snap)}
                        >
                          <Icon name="rotate-ccw" />
                          {t('actions.undo')}
                        </Button>
                      </div>
                    </div>
                    {diff && (
                      <div className="border-t border-border p-3">
                        {diff.loading ? (
                          <p className="text-xs text-muted-foreground">
                            {t('actions.loadingDiff')}
                          </p>
                        ) : unchanged ? (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Icon name="check" className="size-3.5" />
                            {t('noUndo')}
                          </p>
                        ) : (
                          <LineDiffView
                            a={diff.current ?? ''}
                            b={diff.previous}
                            leftLabel={t('diffLabels.current')}
                            rightLabel={t('diffLabels.before')}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirmUndo != null}
        onOpenChange={(open) => !open && setConfirmUndo(null)}
        title={t('confirmUndo.title')}
        description={t('confirmUndo.desc', {
          file: confirmUndo?.originalPath ?? t('theFile'),
        })}
        confirmLabel={t('undoChange')}
        destructive={false}
        onConfirm={() => confirmUndo && void undo(confirmUndo)}
      />
    </div>
  )
}
