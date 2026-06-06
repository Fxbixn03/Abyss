import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import {
  useConfigBase,
  useInstructionsBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { estimateTokens, formatTokens } from '../lib/tokens'
import type { AgentMcp, ConflictFinding, ContextSource } from '../lib/conflicts'
import {
  detectInstructionConflicts,
  detectMcpConflicts,
} from '../lib/conflicts'

interface LayerItem {
  name: string
  tokens: number
}

interface ContextLayer {
  id: string
  label: string
  icon: string
  /** Tailwind border colour suffix for the left accent. */
  accent: string
  tokens: number
  estimated?: boolean
  preview?: string
  items?: LayerItem[]
  note?: string
}

/** Static accent → class map (Tailwind can't see runtime-built class names). */
const ACCENT: Record<string, { border: string; bar: string }> = {
  primary: { border: 'border-l-primary', bar: 'bg-primary' },
  success: { border: 'border-l-success', bar: 'bg-success' },
  warning: { border: 'border-l-warning', bar: 'bg-warning' },
  destructive: { border: 'border-l-destructive', bar: 'bg-destructive' },
  'muted-foreground': {
    border: 'border-l-muted-foreground',
    bar: 'bg-muted-foreground',
  },
}

/** Very rough base-prompt size — the CLI provides the real one at runtime. */
const BASE_PROMPT_TOKENS = 2500
/** Rough per-server tool-schema cost added to the model's context. */
const MCP_SCHEMA_TOKENS = 250

export function ContextPage() {
  const agent = useActiveAgent()
  const instructionsBase = useInstructionsBase(agent.id)
  const configBase = useConfigBase(agent.id)
  const projectDir = useProjectDir()
  const getBasePath = useSettingsStore((s) => s.getBasePath)

  const [layers, setLayers] = useState<ContextLayer[]>([])
  const [conflicts, setConflicts] = useState<ConflictFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!agent.capabilities.instructions) return
    let active = true

    const build = async () => {
      setLoading(true)
      const caps = agent.capabilities
      const sources: ContextSource[] = []
      const next: ContextLayer[] = []

      next.push({
        id: 'base',
        label: 'Base system prompt',
        icon: 'cpu',
        accent: 'muted-foreground',
        tokens: BASE_PROMPT_TOKENS,
        estimated: true,
        note: 'Provided by the CLI at runtime — size is approximate.',
      })

      // Instructions file (CLAUDE.md / AGENTS.md / …).
      if (instructionsBase) {
        const spec = agent.getConfigFileSpecs()[0]
        const content = spec
          ? await ipc
              .readAgentConfig(agent.id, spec.id, instructionsBase)
              .then((r) => r.content)
              .catch(() => '')
          : ''
        if (content.trim()) {
          sources.push({ label: 'Instructions', text: content })
          next.push({
            id: 'instructions',
            label: 'Project instructions & memory',
            icon: 'file-text',
            accent: 'primary',
            tokens: estimateTokens(content),
            preview: content.slice(0, 600),
          })
        }
      }

      // Markdown collections (subagents / skills / commands).
      const collections: {
        kind: 'agents' | 'skills' | 'commands'
        label: string
        icon: string
        accent: string
      }[] = [
        { kind: 'agents', label: 'Subagent instructions', icon: 'bot', accent: 'success' },
        { kind: 'skills', label: 'Skills', icon: 'graduation-cap', accent: 'warning' },
        { kind: 'commands', label: 'Commands', icon: 'square-slash', accent: 'primary' },
      ]
      for (const col of collections) {
        if (!caps[col.kind] || !configBase) continue
        const list = await ipc.listCollection(configBase, col.kind).catch(() => [])
        if (list.length === 0) continue
        const items: LayerItem[] = []
        let total = 0
        for (const item of list) {
          const content = await ipc
            .readCollectionItem(configBase, col.kind, item.id)
            .then((r) => r.content)
            .catch(() => '')
          const t = estimateTokens(content)
          total += t
          items.push({ name: item.name, tokens: t })
          if (content.trim()) {
            sources.push({ label: `${col.label}: ${item.name}`, text: content })
          }
        }
        next.push({
          id: col.kind,
          label: col.label,
          icon: col.icon,
          accent: col.accent,
          tokens: total,
          items,
        })
      }

      // Hooks (inject context at lifecycle moments).
      if (caps.hooks && configBase) {
        const hooks = await ipc.getHooks(configBase).catch(() => [])
        if (hooks.length > 0) {
          const items = hooks.map((h) => ({
            name: `${h.event}${h.matcher ? ` · ${h.matcher}` : ''}`,
            tokens: estimateTokens(h.command),
          }))
          next.push({
            id: 'hooks',
            label: 'Hook injections',
            icon: 'webhook',
            accent: 'destructive',
            tokens: items.reduce((n, i) => n + i.tokens, 0),
            estimated: true,
            note: 'Hooks inject output at runtime — size varies.',
            items,
          })
        }
      }

      // MCP servers (tool schemas added to context).
      if (caps.mcp && configBase) {
        const servers = await ipc
          .getMcpServers(agent.id, configBase, projectDir)
          .catch(() => [])
        const enabled = servers.filter((s) => s.enabled)
        if (enabled.length > 0) {
          next.push({
            id: 'mcp',
            label: 'MCP tool schemas',
            icon: 'plug',
            accent: 'success',
            tokens: enabled.length * MCP_SCHEMA_TOKENS,
            estimated: true,
            note: 'Each enabled server adds its tool definitions to context.',
            items: enabled.map((s) => ({
              name: s.name,
              tokens: MCP_SCHEMA_TOKENS,
            })),
          })
        }
      }

      next.push({
        id: 'runtime',
        label: 'Conversation history & user input',
        icon: 'messages-square',
        accent: 'muted-foreground',
        tokens: 0,
        estimated: true,
        note: 'Added live during the session — grows with the conversation.',
      })

      // Conflicts: within-agent instructions + cross-agent MCP wiring.
      const findings = detectInstructionConflicts(sources)
      const mcpAgents: AgentMcp[] = []
      for (const a of agentRegistry.getAll()) {
        if (!a.capabilities.mcp) continue
        const base = getBasePath(a.id)
        if (!base) continue
        const servers = await ipc.getMcpServers(a.id, base).catch(() => [])
        mcpAgents.push({
          agentId: a.id,
          servers: servers
            .filter((s) => s.enabled)
            .map((s) => ({
              name: s.name,
              command: s.command,
              args: s.args,
              url: s.url,
            })),
        })
      }
      findings.push(...detectMcpConflicts(mcpAgents))

      if (active) {
        setLayers(next)
        setConflicts(findings)
        setLoading(false)
      }
    }

    void build()
    return () => {
      active = false
    }
  }, [agent, instructionsBase, configBase, projectDir, getBasePath])

  const totalTokens = useMemo(
    () => layers.reduce((n, l) => n + l.tokens, 0),
    [layers],
  )
  const maxLayer = useMemo(
    () => layers.reduce((m, l) => Math.max(m, l.tokens), 1),
    [layers],
  )

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (!agent.capabilities.instructions) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Context" icon="list-tree" />
        <EmptyState
          icon="list-tree"
          title={`${agent.displayName} has no compiled context`}
          description="Switch to an agent with instruction files to inspect what the model sees."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Context"
        description={`What ${agent.displayName} actually sees — layered, with token estimates`}
        icon="list-tree"
        actions={
          <Badge variant={totalTokens > 40000 ? 'warning' : 'muted'} className="font-code">
            ~{formatTokens(totalTokens)} tokens
          </Badge>
        }
      />

      {totalTokens > 40000 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Icon name="alert-triangle" className="size-4 shrink-0 text-warning" />
          <span>
            Base context is large (~{formatTokens(totalTokens)} tokens before the
            conversation). Heavy setups risk truncation on smaller models.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Compiling context…</p>
        ) : (
          <section className="space-y-2">
            {layers.map((layer, i) => {
              const open = expanded.has(layer.id)
              const hasDetail = Boolean(layer.items?.length || layer.preview)
              return (
                <Card
                  key={layer.id}
                  className={cn(
                    'overflow-hidden border-l-4',
                    ACCENT[layer.accent]?.border,
                  )}
                >
                  <button
                    type="button"
                    disabled={!hasDetail}
                    onClick={() => hasDetail && toggle(layer.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
                  >
                    <span className="font-code text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <Icon name={layer.icon} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {layer.label}
                        {layer.estimated && (
                          <span className="rounded bg-muted px-1 text-[10px] font-medium uppercase text-muted-foreground">
                            est.
                          </span>
                        )}
                      </span>
                      {layer.note && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {layer.note}
                        </span>
                      )}
                    </span>
                    {/* Proportional bar */}
                    <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                      <span
                        className={cn('block h-full', ACCENT[layer.accent]?.bar)}
                        style={{
                          width: `${Math.max(4, (layer.tokens / maxLayer) * 100)}%`,
                        }}
                      />
                    </span>
                    <Badge variant="muted" className="shrink-0 font-code">
                      {formatTokens(layer.tokens)}
                    </Badge>
                    {hasDetail && (
                      <Icon
                        name={open ? 'chevron-down' : 'chevron-right'}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                  </button>

                  {open && layer.items && (
                    <div className="border-t border-border px-3 py-2">
                      {layer.items.map((item, idx) => (
                        <div
                          key={`${item.name}-${idx}`}
                          className="flex items-center justify-between gap-2 py-0.5 text-xs"
                        >
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 font-code text-muted-foreground">
                            {formatTokens(item.tokens)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {open && layer.preview && (
                    <pre className="max-h-48 overflow-auto border-t border-border bg-muted/30 px-3 py-2 font-code text-[11px] leading-relaxed text-muted-foreground">
                      {layer.preview}
                      {layer.preview.length >= 600 ? '\n…' : ''}
                    </pre>
                  )}
                </Card>
              )
            })}
          </section>
        )}

        {!loading && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Icon name="shield-alert" className="size-4" />
              Conflicts
              <Badge variant={conflicts.length ? 'warning' : 'success'}>
                {conflicts.length}
              </Badge>
            </h2>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conflicting rules, duplicate instructions or MCP clashes
                detected.
              </p>
            ) : (
              <div className="space-y-2">
                {conflicts.map((c, i) => (
                  <Card
                    key={i}
                    className={cn(
                      'flex items-start gap-2.5 p-3 text-sm',
                      c.severity === 'warning'
                        ? 'border-l-4 border-l-warning'
                        : 'border-l-4 border-l-muted-foreground',
                    )}
                  >
                    <Icon
                      name={c.severity === 'warning' ? 'alert-triangle' : 'info'}
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        c.severity === 'warning'
                          ? 'text-warning'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0">
                      <p>{c.message}</p>
                      <p className="mt-0.5 truncate font-code text-xs text-muted-foreground">
                        {c.sources.join(' · ')}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
