import { useEffect, useState } from 'react'
import type { AgentId } from '@/shared/types/agent'
import type { McpServerEntry, PermissionRules } from '@/shared/types/config'
import type {
  SurfaceComparison,
  SyncAllResult,
  SyncSurface,
} from '@/shared/types/sync'
import { SYNC_SURFACE_LABELS } from '@/shared/types/sync'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import { lineDiff } from '../lib/lineDiff'

const SURFACES: SyncSurface[] = ['instructions', 'mcp', 'permissions']

function AgentSelect({
  value,
  onChange,
}: {
  value: AgentId
  onChange: (id: AgentId) => void
}) {
  const agents = useAllAgents()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="flex items-center gap-2">
              <AgentGlyph agent={a} className="size-4 rounded-[3px]" />
              {a.displayName}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function mcpKey(s: McpServerEntry): string {
  return JSON.stringify({
    type: s.type,
    command: s.command,
    args: s.args,
    url: s.url,
    env: s.env,
    enabled: s.enabled,
  })
}

function mcpSummary(s?: McpServerEntry): string {
  if (!s) return '—'
  return s.type === 'stdio'
    ? [s.command, ...(s.args ?? [])].filter(Boolean).join(' ')
    : (s.url ?? '')
}

function InstructionsDiff({ a, b }: { a: string; b: string }) {
  const rows = lineDiff(a, b)
  return (
    <div className="overflow-auto rounded-md border border-border font-code text-xs">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2">
          <div
            className={cn(
              'whitespace-pre-wrap break-words border-r border-border px-2 py-0.5',
              r.type === 'remove' && 'bg-destructive/10',
            )}
          >
            {r.left ?? ''}
          </div>
          <div
            className={cn(
              'whitespace-pre-wrap break-words px-2 py-0.5',
              r.type === 'add' && 'bg-success/10',
            )}
          >
            {r.right ?? ''}
          </div>
        </div>
      ))}
    </div>
  )
}

function McpDiff({ a, b }: { a: McpServerEntry[]; b: McpServerEntry[] }) {
  const names = [
    ...new Set([...a.map((s) => s.name), ...b.map((s) => s.name)]),
  ].sort()
  return (
    <div className="overflow-hidden rounded-md border border-border text-xs">
      {names.map((name) => {
        const sa = a.find((s) => s.name === name)
        const sb = b.find((s) => s.name === name)
        const differ = !sa || !sb || mcpKey(sa) !== mcpKey(sb)
        return (
          <div
            key={name}
            className="grid grid-cols-[160px_1fr_1fr] items-center gap-2 border-b border-border/60 px-2 py-1.5 last:border-0"
          >
            <span className="flex items-center gap-1.5 truncate font-medium">
              {differ && (
                <Icon name="arrow-left-right" className="size-3 text-warning" />
              )}
              {name}
            </span>
            <span
              className={cn(
                'truncate font-code',
                !sa && 'text-muted-foreground',
              )}
            >
              {mcpSummary(sa)}
            </span>
            <span
              className={cn(
                'truncate font-code',
                !sb && 'text-muted-foreground',
              )}
            >
              {mcpSummary(sb)}
            </span>
          </div>
        )
      })}
      {names.length === 0 && (
        <p className="px-2 py-2 text-muted-foreground">No MCP servers.</p>
      )}
    </div>
  )
}

function PermissionsDiff({ a, b }: { a: PermissionRules; b: PermissionRules }) {
  const cats: (keyof PermissionRules)[] = ['allow', 'deny', 'ask']
  return (
    <div className="flex flex-col gap-3">
      {cats.map((cat) => {
        const union = [...new Set([...a[cat], ...b[cat]])].sort()
        return (
          <div key={cat} className="rounded-md border border-border">
            <p className="border-b border-border px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {cat}
            </p>
            {union.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">none</p>
            ) : (
              union.map((rule) => {
                const inA = a[cat].includes(rule)
                const inB = b[cat].includes(rule)
                return (
                  <div
                    key={rule}
                    className="grid grid-cols-2 gap-2 border-b border-border/50 px-2 py-1 text-xs last:border-0"
                  >
                    <span
                      className={cn(
                        'truncate font-code',
                        !inA && 'text-muted-foreground line-through',
                      )}
                    >
                      {inA ? rule : '—'}
                    </span>
                    <span
                      className={cn(
                        'truncate font-code',
                        !inB && 'text-muted-foreground line-through',
                      )}
                    >
                      {inB ? rule : '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ComparePage() {
  const agents = useAllAgents()
  const [surface, setSurface] = useState<SyncSurface>('instructions')
  const [agentA, setAgentA] = useState<AgentId>(agents[0]?.id ?? 'claude')
  const [agentB, setAgentB] = useState<AgentId>(
    agents[1]?.id ?? agents[0]?.id ?? 'codex',
  )
  const [cmp, setCmp] = useState<SurfaceComparison | null>(null)
  const [confirm, setConfirm] = useState<null | 'ab' | 'ba'>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncAll, setSyncAll] = useState<SyncAllResult[] | null>(null)

  const nameOf = (id: AgentId) =>
    agents.find((a) => a.id === id)?.displayName ?? id

  useEffect(() => {
    let active = true
    void ipc.syncCompare(surface, agentA, agentB).then((c) => {
      if (active) setCmp(c)
    })
    return () => {
      active = false
    }
  }, [surface, agentA, agentB])

  const reload = async () => {
    setCmp(await ipc.syncCompare(surface, agentA, agentB))
  }

  const doCopy = async (dir: 'ab' | 'ba') => {
    setConfirm(null)
    setNotice(null)
    setSyncAll(null)
    const from = dir === 'ab' ? agentA : agentB
    const to = dir === 'ab' ? agentB : agentA
    try {
      const r = await ipc.syncCopy(surface, from, to, false)
      setNotice(
        r.changed
          ? `Copied ${SYNC_SURFACE_LABELS[surface]} from ${nameOf(from)} to ${nameOf(to)}.`
          : `${nameOf(to)} already matched ${nameOf(from)}.`,
      )
      await reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Copy failed.')
    }
  }

  const doSyncAll = async () => {
    setNotice(null)
    const r = await ipc.syncMcpAll(agentA, false)
    setSyncAll(r)
    await reload()
  }

  const supportedBoth = cmp?.a.supported && cmp?.b.supported

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Compare & Sync"
        description="Diff two agents and copy config between them"
        icon="git-compare"
      />

      <div className="flex flex-wrap items-center gap-2">
        <AgentSelect value={agentA} onChange={setAgentA} />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Swap"
          onClick={() => {
            setAgentA(agentB)
            setAgentB(agentA)
          }}
        >
          <Icon name="arrow-left-right" />
        </Button>
        <AgentSelect value={agentB} onChange={setAgentB} />

        <div className="mx-2 h-6 w-px bg-border" />

        <Select
          value={surface}
          onValueChange={(v) => setSurface(v as SyncSurface)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SURFACES.map((s) => (
              <SelectItem key={s} value={s}>
                {SYNC_SURFACE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {cmp && (
          <Badge
            variant={
              !supportedBoth ? 'muted' : cmp.equal ? 'success' : 'warning'
            }
            className="ml-1"
          >
            {!supportedBoth ? 'n/a' : cmp.equal ? 'in sync' : 'differs'}
          </Badge>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-accent px-3 py-2 text-sm">
          <span className="truncate">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      {supportedBoth && !cmp?.equal && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setConfirm('ab')}>
            {nameOf(agentA)}
            <Icon name="arrow-right" />
            {nameOf(agentB)}
          </Button>
          <Button size="sm" onClick={() => setConfirm('ba')}>
            {nameOf(agentA)}
            <Icon name="arrow-left" />
            {nameOf(agentB)}
          </Button>
          {surface === 'mcp' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void doSyncAll()}
            >
              <Icon name="refresh-cw" />
              Sync {nameOf(agentA)} → all agents
            </Button>
          )}
        </div>
      )}

      {syncAll && (
        <div className="rounded-md border border-border bg-card/40 p-2 text-xs">
          {syncAll.map((r) => (
            <div key={r.agentId} className="flex items-center gap-2">
              <Badge variant={r.changed ? 'warning' : 'success'}>
                {r.changed ? 'updated' : 'same'}
              </Badge>
              <span className="font-code">{nameOf(r.agentId)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          {(() => {
            const a = agents.find((x) => x.id === agentA)
            return a ? (
              <AgentGlyph agent={a} className="size-4 rounded-[3px]" />
            ) : null
          })()}
          {nameOf(agentA)}
        </span>
        <span className="flex items-center gap-2">
          {(() => {
            const b = agents.find((x) => x.id === agentB)
            return b ? (
              <AgentGlyph agent={b} className="size-4 rounded-[3px]" />
            ) : null
          })()}
          {nameOf(agentB)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!cmp ? (
          <p className="text-sm text-muted-foreground">Comparing…</p>
        ) : !supportedBoth ? (
          <EmptyState
            icon="git-compare"
            title="Surface not supported by both agents"
            description={`${cmp.a.supported ? nameOf(agentB) : nameOf(agentA)} has no ${SYNC_SURFACE_LABELS[surface].toLowerCase()}.`}
          />
        ) : cmp.a.value?.kind === 'instructions' &&
          cmp.b.value?.kind === 'instructions' ? (
          <InstructionsDiff a={cmp.a.value.content} b={cmp.b.value.content} />
        ) : cmp.a.value?.kind === 'mcp' && cmp.b.value?.kind === 'mcp' ? (
          <McpDiff a={cmp.a.value.servers} b={cmp.b.value.servers} />
        ) : cmp.a.value?.kind === 'permissions' &&
          cmp.b.value?.kind === 'permissions' ? (
          <PermissionsDiff a={cmp.a.value.rules} b={cmp.b.value.rules} />
        ) : null}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={
          confirm === 'ab'
            ? `Copy ${SYNC_SURFACE_LABELS[surface]} ${nameOf(agentA)} → ${nameOf(agentB)}?`
            : `Copy ${SYNC_SURFACE_LABELS[surface]} ${nameOf(agentB)} → ${nameOf(agentA)}?`
        }
        description="This overwrites the target agent's config. A snapshot is taken first (see History), so it can be undone."
        confirmLabel="Copy"
        destructive={false}
        onConfirm={() => {
          if (confirm) void doCopy(confirm)
        }}
      />
    </div>
  )
}
