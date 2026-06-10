import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PermissionRules } from '@/shared/types/config'
import type { CollectionKind } from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { joinPath, useScope } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useCollectionSelection } from '@/features/collections/store/collectionSelection.store'
import {
  detectMcpConflicts,
  type AgentMcp,
} from '@/features/context/lib/conflicts'
import { parseToml, fieldsFromData } from '@/features/subagents/lib/toml'
import type {
  LintCodexSubagent,
  LintFinding,
  LintInstruction,
  LintItem,
  LintReadError,
  LintSeverity,
} from '../lib/lint'
import { runLint } from '../lib/lint'

const EMPTY_PERMS: PermissionRules = { allow: [], deny: [], ask: [] }

const COLLECTION_KINDS: CollectionKind[] = [
  'agents',
  'skills',
  'commands',
  'rules',
]
const LINT_KIND: Record<CollectionKind, LintItem['kind']> = {
  agents: 'agent',
  skills: 'skill',
  commands: 'command',
  rules: 'rule',
}

const SEVERITY_META: Record<
  LintSeverity,
  { label: string; icon: string; className: string; badge: string }
> = {
  error: {
    label: 'Errors',
    icon: 'circle-x',
    className: 'text-destructive',
    badge: 'border-l-destructive',
  },
  warning: {
    label: 'Warnings',
    icon: 'alert-triangle',
    className: 'text-warning',
    badge: 'border-l-warning',
  },
  info: {
    label: 'Hints',
    icon: 'info',
    className: 'text-muted-foreground',
    badge: 'border-l-muted-foreground',
  },
}

const SEVERITY_ORDER: LintSeverity[] = ['error', 'warning', 'info']

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : String(e)

/** Read every item of one collection, keeping frontmatter; collect read errors. */
async function readItems(
  agentId: string,
  base: string,
  kind: CollectionKind,
): Promise<{ items: LintItem[]; errors: LintReadError[] }> {
  let list
  try {
    list = await ipc.listCollection(agentId, base, kind)
  } catch (e) {
    return {
      items: [],
      errors: [
        { label: `${COLLECTION_LABELS[kind].plural}`, detail: errMsg(e) },
      ],
    }
  }
  const items: LintItem[] = []
  const errors: LintReadError[] = []
  for (const i of list) {
    try {
      const r = await ipc.readCollectionItem(agentId, base, kind, i.id)
      items.push({
        kind: LINT_KIND[kind],
        id: i.id,
        name: i.name,
        content: r.content,
        description: i.description,
        model: i.model,
        tools: i.tools,
        globs: i.globs,
        alwaysApply: i.alwaysApply,
        path: i.path,
      })
    } catch (e) {
      errors.push({
        label: `${COLLECTION_LABELS[kind].singular} “${i.name}”`,
        detail: errMsg(e),
      })
    }
  }
  return { items, errors }
}

/** Read + parse Codex TOML subagents for required fields and enum validity. */
async function readCodexSubagents(
  base: string,
): Promise<{ subs: LintCodexSubagent[]; errors: LintReadError[] }> {
  let list
  try {
    list = await ipc.listCodexSubagents(base)
  } catch {
    return { subs: [], errors: [] } // dir may simply not exist
  }
  const subs: LintCodexSubagent[] = []
  const errors: LintReadError[] = []
  for (const s of list) {
    try {
      const { raw } = await ipc.readCodexSubagent(base, s.id)
      const { data, error } = parseToml(raw)
      const f = fieldsFromData(data)
      const missing = (
        ['name', 'description', 'developer_instructions'] as const
      ).filter((k) => !f[k].trim())
      subs.push({
        id: s.id,
        name: s.name,
        description: f.description,
        model: f.model,
        sandboxMode: f.sandbox_mode,
        reasoning: f.model_reasoning_effort,
        missing,
        parseError: error,
        path: s.path,
      })
    } catch (e) {
      errors.push({ label: `Codex subagent “${s.name}”`, detail: errMsg(e) })
    }
  }
  return { subs, errors }
}

export function ValidationPage() {
  const agent = useActiveAgent()
  const allAgents = useAllAgents()
  const { projectDir } = useScope()
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  const requestOpen = useCollectionSelection((s) => s.requestOpen)
  const navigate = useNavigate()

  const [findings, setFindings] = useState<LintFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [ranAt, setRanAt] = useState(0)

  const agentsKey = allAgents.map((a) => a.id).join(',')

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      const caps = agent.capabilities
      const readErrors: LintReadError[] = []
      const projectDirArg = projectDir ?? undefined

      // Scopes to validate: global always, project merged on top when active.
      const globalBase = getBasePath(agent.id)
      const instrScopes: { scope: string; base: string }[] = []
      const configScopes: { scope: string; base: string }[] = []
      if (globalBase) {
        instrScopes.push({ scope: 'global', base: globalBase })
        configScopes.push({ scope: 'global', base: globalBase })
      }
      if (projectDir) {
        instrScopes.push({ scope: 'project', base: projectDir })
        configScopes.push({
          scope: 'project',
          base: joinPath(projectDir, `.${agent.id}`),
        })
      }

      // Instructions: every spec, every scope (the agent merges them).
      const instructions: LintInstruction[] = []
      for (const { scope, base } of instrScopes) {
        for (const spec of agent.getConfigFileSpecs()) {
          try {
            const r = await ipc.readAgentConfig(agent.id, spec.id, base)
            if (r.exists || r.content.trim()) {
              instructions.push({
                specId: spec.id,
                filename: spec.filename,
                scope,
                content: r.content,
                path: r.path,
              })
            }
          } catch (e) {
            readErrors.push({
              label: `${spec.filename} (${scope})`,
              detail: errMsg(e),
            })
          }
        }
      }

      // Collections: project overrides global (merged), keyed by kind:id.
      const byKey = new Map<string, LintItem>()
      for (const { base } of configScopes) {
        for (const kind of COLLECTION_KINDS) {
          if (!caps[kind]) continue
          const { items, errors } = await readItems(agent.id, base, kind)
          readErrors.push(...errors)
          for (const it of items) byKey.set(`${it.kind}:${it.id}`, it)
        }
      }
      const all = [...byKey.values()]
      const pick = (k: LintItem['kind']) => all.filter((i) => i.kind === k)

      // Codex TOML subagents (its own shape, not markdown collections).
      let codexSubagents: LintCodexSubagent[] = []
      if (agent.id === 'codex') {
        const map = new Map<string, LintCodexSubagent>()
        for (const { base } of configScopes) {
          const { subs, errors } = await readCodexSubagents(base)
          readErrors.push(...errors)
          for (const s of subs) map.set(s.id, s)
        }
        codexSubagents = [...map.values()]
      }

      // MCP / hooks / permissions / raw settings — from the global base.
      const mcp =
        caps.mcp && globalBase
          ? await ipc
              .getMcpServers(agent.id, globalBase, projectDirArg)
              .catch((e) => {
                readErrors.push({ label: 'MCP servers', detail: errMsg(e) })
                return []
              })
          : []
      const hooks =
        caps.hooks && globalBase
          ? await ipc.getHooks(agent.id, globalBase).catch((e) => {
              readErrors.push({ label: 'Hooks', detail: errMsg(e) })
              return []
            })
          : []
      const permissions =
        caps.permissions && globalBase
          ? await ipc.getPermissions(agent.id, globalBase).catch((e) => {
              readErrors.push({ label: 'Permissions', detail: errMsg(e) })
              return EMPTY_PERMS
            })
          : EMPTY_PERMS

      const rawSettings: { file: string; content: string; path?: string }[] = []
      if (caps.rawSettings && globalBase) {
        for (const file of ['settings.json', 'settings.local.json'] as const) {
          try {
            const r = await ipc.readRawSettings(globalBase, file)
            if (r.exists)
              rawSettings.push({ file, content: r.content, path: r.path })
          } catch (e) {
            readErrors.push({ label: file, detail: errMsg(e) })
          }
        }
      }

      let result = runLint({
        agentId: agent.id,
        instructions,
        agents: pick('agent'),
        skills: pick('skill'),
        commands: pick('command'),
        rules: pick('rule'),
        codexSubagents,
        mcp: mcp.map((s) => ({
          name: s.name,
          command: s.command,
          url: s.url,
          enabled: s.enabled,
        })),
        hooks: hooks.map((h) => ({
          event: h.event,
          matcher: h.matcher,
          command: h.command,
        })),
        permissions,
        rawSettings,
        readErrors,
      })
      if (!caps.permissions) {
        result = result.filter((f) => f.category !== 'Permissions')
      }

      // Cross-agent MCP conflicts (needs every agent's servers).
      const agentMcps: AgentMcp[] = []
      for (const a of allAgents) {
        if (!a.capabilities.mcp) continue
        const base = getBasePath(a.id)
        if (!base) continue
        const servers = await ipc
          .getMcpServers(a.id, base, projectDirArg)
          .catch(() => [])
        agentMcps.push({
          agentId: a.id,
          servers: servers.map((s) => ({
            name: s.name,
            command: s.command,
            args: s.args,
            url: s.url,
          })),
        })
      }
      detectMcpConflicts(agentMcps).forEach((c, i) => {
        result.push({
          id: `mcp-cross-${i}`,
          severity: c.severity,
          category: 'MCP',
          title: 'Cross-agent MCP conflict',
          detail: `${c.message} (${c.sources.join(', ')})`,
          open: { route: '/mcp' },
        })
      })

      if (active) {
        setFindings(result)
        setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, agentsKey, projectDir, getBasePath, ranAt])

  const counts = useMemo(() => {
    const c: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 }
    for (const f of findings) c[f.severity] += 1
    return c
  }, [findings])

  const openFinding = (f: LintFinding) => {
    if (!f.open) return
    if (f.open.collectionKind && f.open.itemId) {
      requestOpen(f.open.collectionKind, f.open.itemId)
    }
    navigate(f.open.route)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Validation"
        description={`Lint ${agent.displayName}'s config for risks and rot`}
        icon="clipboard-check"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRanAt(Date.now())}
            disabled={loading}
          >
            <Icon
              name={loading ? 'loader' : 'refresh-cw'}
              className={loading ? 'animate-spin' : ''}
            />
            Re-run
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {SEVERITY_ORDER.map((sev) => (
          <span
            key={sev}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm',
              SEVERITY_META[sev].className,
            )}
          >
            <Icon name={SEVERITY_META[sev].icon} className="size-4" />
            {counts[sev]} {SEVERITY_META[sev].label.toLowerCase()}
          </span>
        ))}
        {projectDir && (
          <Badge variant="muted" className="ml-1">
            merged: global + project
          </Badge>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Running checks…</p>
        ) : findings.length === 0 ? (
          <Card className="flex items-center gap-3 border-l-4 border-l-success p-4">
            <Icon name="circle-check" className="size-5 text-success" />
            <div>
              <p className="font-medium">All clear</p>
              <p className="text-sm text-muted-foreground">
                No issues found in {agent.displayName}'s current config.
              </p>
            </div>
          </Card>
        ) : (
          SEVERITY_ORDER.flatMap((sev) =>
            findings
              .filter((f) => f.severity === sev)
              .map((f) => (
                <Card
                  key={f.id}
                  className={cn(
                    'flex items-start gap-3 border-l-4 p-3',
                    SEVERITY_META[sev].badge,
                  )}
                >
                  <Icon
                    name={SEVERITY_META[sev].icon}
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      SEVERITY_META[sev].className,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{f.title}</p>
                      <Badge variant="muted" className="shrink-0 text-[10px]">
                        {f.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {f.open && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openFinding(f)}
                      >
                        <Icon name="arrow-right" />
                        Open
                      </Button>
                    )}
                    {f.path && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void ipc.revealPath(f.path as string)}
                        aria-label="Reveal in folder"
                        title="Reveal in folder"
                      >
                        <Icon name="folder-open" />
                      </Button>
                    )}
                  </div>
                </Card>
              )),
          )
        )}
      </div>
    </div>
  )
}
