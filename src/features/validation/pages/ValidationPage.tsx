import { useEffect, useMemo, useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useInstructionsBase,
  useProjectDir,
} from '@/features/scope/hooks/useScopedBase'
import { estimateTokens } from '@/features/context/lib/tokens'
import type {
  LintCollectionItem,
  LintFinding,
  LintSeverity,
} from '../lib/lint'
import { runLint } from '../lib/lint'

const EMPTY_PERMS: PermissionRules = { allow: [], deny: [], ask: [] }
const BASE_PROMPT_TOKENS = 2500
const MCP_SCHEMA_TOKENS = 250

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

async function readContents(
  base: string,
  kind: 'agents' | 'skills' | 'commands',
): Promise<LintCollectionItem[]> {
  const list = await ipc.listCollection(base, kind).catch(() => [])
  return Promise.all(
    list.map(async (i) => ({
      id: i.id,
      name: i.name,
      content: await ipc
        .readCollectionItem(base, kind, i.id)
        .then((r) => r.content)
        .catch(() => ''),
    })),
  )
}

export function ValidationPage() {
  const agent = useActiveAgent()
  const instructionsBase = useInstructionsBase(agent.id)
  const configBase = useConfigBase(agent.id)
  const projectDir = useProjectDir()

  const [findings, setFindings] = useState<LintFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [ranAt, setRanAt] = useState<number>(0)

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      const caps = agent.capabilities

      const spec = agent.getConfigFileSpecs()[0]
      const instructions =
        spec && instructionsBase
          ? await ipc
              .readAgentConfig(agent.id, spec.id, instructionsBase)
              .then((r) => r.content)
              .catch(() => '')
          : ''

      const agents =
        caps.agents && configBase ? await readContents(configBase, 'agents') : []
      const skills =
        caps.skills && configBase ? await readContents(configBase, 'skills') : []
      const commands =
        caps.commands && configBase
          ? await readContents(configBase, 'commands')
          : []

      const mcp =
        caps.mcp && configBase
          ? await ipc.getMcpServers(agent.id, configBase, projectDir).catch(() => [])
          : []
      const hooks =
        caps.hooks && configBase
          ? await ipc.getHooks(configBase).catch(() => [])
          : []
      const permissions =
        caps.permissions && configBase
          ? await ipc.getPermissions(agent.id, configBase).catch(() => EMPTY_PERMS)
          : EMPTY_PERMS

      const totalTokens =
        BASE_PROMPT_TOKENS +
        estimateTokens(instructions) +
        [...agents, ...skills, ...commands].reduce(
          (n, i) => n + estimateTokens(i.content),
          0,
        ) +
        mcp.filter((s) => s.enabled).length * MCP_SCHEMA_TOKENS

      let result = runLint({
        instructions,
        agents,
        skills,
        commands,
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
        totalTokens,
      })
      // Drop permission findings for agents that don't model allow/deny rules.
      if (!caps.permissions) {
        result = result.filter((f) => f.category !== 'Permissions')
      }

      if (active) {
        setFindings(result)
        setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [agent, instructionsBase, configBase, projectDir, ranAt])

  const counts = useMemo(() => {
    const c: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 }
    for (const f of findings) c[f.severity] += 1
    return c
  }, [findings])

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
            <Icon name={loading ? 'loader' : 'refresh-cw'} className={loading ? 'animate-spin' : ''} />
            Re-run
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
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
                  className={cn('flex items-start gap-3 border-l-4 p-3', SEVERITY_META[sev].badge)}
                >
                  <Icon
                    name={SEVERITY_META[sev].icon}
                    className={cn('mt-0.5 size-4 shrink-0', SEVERITY_META[sev].className)}
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
                </Card>
              )),
          )
        )}
      </div>
    </div>
  )
}
