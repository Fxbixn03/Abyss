import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import type { AgentAdapter } from '@/shared/types/agent'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useScope } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { lineDiff, diffStats } from '@/features/config/lib/diff'
import { extractVariables, applyVariables } from '../lib/variables'
import { insertBlock, isBlockPresent, type InsertMode } from '../lib/apply'
import { VariablesFields } from './VariablesFields'

export interface ApplySource {
  title: string
  content: string
  agentIds?: string[]
}

interface TargetState {
  path: string
  before: string
}

const PREFIX = { add: '+', remove: '-', context: ' ' } as const

/** Inline line diff for one agent's instruction file. */
function DiffBlock({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => lineDiff(before, after), [before, after])
  return (
    <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-card font-code text-[11px] leading-relaxed">
      <pre className="min-w-full">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'px-2 py-px',
              line.type === 'add' && 'bg-success/15 text-success',
              line.type === 'remove' && 'bg-destructive/15 text-destructive',
              line.type === 'context' && 'text-muted-foreground',
            )}
          >
            <span className="select-none opacity-60">{PREFIX[line.type]} </span>
            {line.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}

const specIdFor = (agent: AgentAdapter): string =>
  agent.getConfigFileSpecs()[0]?.id ?? 'instructions'

/**
 * Applies a template to one or more agents' instruction files: fills variables,
 * picks targets (scope-aware), chooses append/prepend, shows a per-agent diff,
 * and skips files where the block is already present.
 */
export function TemplateApplyDialog({
  open,
  onOpenChange,
  source,
  onApplied,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  source: ApplySource | null
  onApplied: (summary: { count: number; title: string }) => void
}) {
  const agents = useAllAgents()
  const activeAgent = useActiveAgent()
  const { scope, projectDir } = useScope()
  // Subscribe to the path inputs so resolved bases stay reactive.
  const settings = useSettingsStore((s) => s.settings)
  const detected = useSettingsStore((s) => s.detected)
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  void settings
  void detected

  const resolveBase = useCallback(
    (agentId: string): string =>
      scope === 'global' ? getBasePath(agentId) : (projectDir ?? ''),
    [scope, projectDir, getBasePath],
  )

  // Seed selection from the template's declared agents (else the active one).
  // The parent remounts this dialog per open (via `key`), so these initializers
  // run fresh each time instead of needing a synchronous reset effect.
  const [values, setValues] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(() => {
    const declared = (source?.agentIds ?? []).filter((id) =>
      agents.some((a) => a.id === id),
    )
    return new Set(declared.length ? declared : source ? [activeAgent.id] : [])
  })
  const [mode, setMode] = useState<InsertMode>('append')
  const [targets, setTargets] = useState<Record<string, TargetState>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const agentsKey = agents.map((a) => a.id).join(',')
  const variables = useMemo(
    () => (source ? extractVariables(source.content) : []),
    [source],
  )
  const finalContent = useMemo(
    () => (source ? applyVariables(source.content, values) : ''),
    [source, values],
  )

  // Read each enabled agent's instruction file so diffs/dedup are accurate.
  // setState only runs inside the async callback, never synchronously.
  useEffect(() => {
    if (!open || !source) return
    let cancelled = false
    Promise.all(
      agents.map(async (agent) => {
        const base = resolveBase(agent.id)
        if (!base) return [agent.id, { path: '', before: '' }] as const
        try {
          const res = await ipc.readAgentConfig(
            agent.id,
            specIdFor(agent),
            base,
          )
          return [agent.id, { path: res.path, before: res.content }] as const
        } catch {
          return [agent.id, { path: base, before: '' }] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      setTargets(Object.fromEntries(entries))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, agentsKey, resolveBase])

  const rows = useMemo(
    () =>
      agents.map((agent) => {
        const t = targets[agent.id]
        const hasPath = Boolean(t?.path)
        const before = t?.before ?? ''
        const after = insertBlock(before, finalContent, mode)
        const applied = isBlockPresent(before, finalContent)
        const selectable = hasPath && !applied
        return {
          agent,
          hasPath,
          path: t?.path ?? '',
          before,
          after,
          applied,
          selectable,
          stats: diffStats(lineDiff(before, after)),
        }
      }),
    [agents, targets, finalContent, mode],
  )

  const chosen = rows.filter((r) => r.selectable && selected.has(r.agent.id))

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleExpanded = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const apply = async () => {
    if (!source || chosen.length === 0) return
    setSaving(true)
    try {
      for (const r of chosen) {
        await ipc.writeAgentConfig(
          r.agent.id,
          specIdFor(r.agent),
          resolveBase(r.agent.id),
          r.after,
        )
      }
      onApplied({ count: chosen.length, title: source.title })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Apply “{source?.title}”</DialogTitle>
          <DialogDescription>
            Insert this template into the instruction file of the selected
            agents.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <VariablesFields
            variables={variables}
            values={values}
            onChange={(name, value) =>
              setValues((v) => ({ ...v, [name]: value }))
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="git-branch" className="size-4" />
              Writing to <span className="font-medium">{scope}</span> scope
              {scope === 'project' && !projectDir && (
                <span className="text-destructive">— no project selected</span>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {(['append', 'prepend'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-[5px] px-2.5 py-0.5 text-xs capitalize transition-colors',
                    mode === m
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {rows.map((r) => {
              const on = r.selectable && selected.has(r.agent.id)
              return (
                <div
                  key={r.agent.id}
                  className={cn(
                    'rounded-md border px-3 py-2 transition-colors',
                    on ? 'border-primary/50 bg-accent' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!r.selectable}
                      onClick={() => toggle(r.agent.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border',
                        )}
                      >
                        {on && <Icon name="check" className="size-3" />}
                      </span>
                      <AgentGlyph
                        agent={r.agent}
                        className="size-4 shrink-0 rounded-[3px]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">
                          {r.agent.displayName}
                        </span>
                        {r.hasPath && (
                          <span className="block truncate font-code text-[10px] text-muted-foreground">
                            {r.path}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!r.hasPath ? (
                        <Badge variant="muted">No path</Badge>
                      ) : r.applied ? (
                        <Badge variant="secondary">Already applied</Badge>
                      ) : (
                        <>
                          <Badge variant="success">+{r.stats.added}</Badge>
                          {r.stats.removed > 0 && (
                            <Badge variant="danger">-{r.stats.removed}</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleExpanded(r.agent.id)}
                            aria-label="Show diff"
                            title="Show diff"
                          >
                            <Icon
                              name={
                                expanded.has(r.agent.id)
                                  ? 'chevron-up'
                                  : 'chevron-down'
                              }
                            />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {expanded.has(r.agent.id) && r.selectable && (
                    <DiffBlock before={r.before} after={r.after} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void apply()}
            disabled={saving || chosen.length === 0}
          >
            {saving
              ? 'Applying…'
              : loading
                ? 'Loading…'
                : `Apply to ${chosen.length} agent${chosen.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
