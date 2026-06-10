import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PermissionColumn, PermissionRules } from '@/shared/types/config'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useProjectDir,
  useScope,
} from '@/features/scope/hooks/useScopedBase'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { CodexApprovals } from '../components/CodexApprovals'
import {
  PermissionRuleEditor,
  type RuleSort,
} from '../components/PermissionRuleEditor'
import { PermissionPresets } from '../components/PermissionPresets'
import { PermissionTester } from '../components/PermissionTester'
import { PermissionShare } from '../components/PermissionShare'
import { PermissionMode } from '../components/PermissionMode'
import { AdditionalDirectories } from '../components/AdditionalDirectories'
import { buildConflictMap, findConflicts } from '../lib/conflicts'
import { mergeEffective } from '../lib/effective'
import { SECURITY_PRESETS } from '../lib/presets'

const SORT_OPTIONS: { value: RuleSort; label: string }[] = [
  { value: 'order', label: 'Order' },
  { value: 'az', label: 'A–Z' },
  { value: 'tool', label: 'By tool' },
]

const EMPTY: PermissionRules = {
  allow: [],
  deny: [],
  ask: [],
  defaultMode: 'default',
  additionalDirectories: [],
}

export function PermissionsPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const globalBase = useBasePath(agent.id)
  const { scope } = useScope()
  const projectDir = useProjectDir()
  const navigate = useNavigate()
  const supported = agent.capabilities.permissions

  const [rules, setRules] = useState<PermissionRules>(EMPTY)
  // Rules from the global profile, surfaced read-only when editing a project.
  const [inherited, setInherited] = useState<PermissionRules>(EMPTY)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [sort, setSort] = useState<RuleSort>('order')
  const [view, setView] = useState<'own' | 'effective'>('own')
  const [mcpServers, setMcpServers] = useState<string[]>([])

  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.getPermissions(agent.id, basePath).then((r) => {
      if (active) setRules(r)
    })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath])

  useEffect(() => {
    if (!supported || scope !== 'project' || !globalBase) return
    let active = true
    void ipc.getPermissions(agent.id, globalBase).then((r) => {
      if (active) setInherited(r)
    })
    return () => {
      active = false
    }
  }, [supported, scope, agent.id, globalBase])

  // Load configured MCP servers so the builder can offer their tools.
  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.getMcpServers(agent.id, basePath, projectDir).then((servers) => {
      if (active) setMcpServers(servers.map((s) => s.name))
    })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath, projectDir])

  // Inherited rules only apply when overriding the global profile in a project.
  const shownInherited = scope === 'project' ? inherited : EMPTY
  const hasInherited =
    scope === 'project' &&
    (inherited.allow.length > 0 ||
      inherited.ask.length > 0 ||
      inherited.deny.length > 0)

  const conflicts = useMemo(() => buildConflictMap(rules), [rules])
  const conflictCount = useMemo(() => findConflicts(rules).length, [rules])
  const effective = useMemo(
    () => mergeEffective(inherited, rules),
    [inherited, rules],
  )
  // Effective view is only meaningful when there are inherited rules to merge.
  const showEffective = view === 'effective' && hasInherited
  const viewRules = showEffective ? effective : rules
  const allEmpty =
    rules.allow.length === 0 &&
    rules.ask.length === 0 &&
    rules.deny.length === 0 &&
    !hasInherited

  const persist = (next: PermissionRules) => {
    setRules(next)
    if (basePath) void ipc.setPermissions(agent.id, basePath, next)
  }

  const move = (
    from: PermissionColumn,
    rule: string,
    to: PermissionColumn,
  ) => {
    if (from === to) return
    persist({
      ...rules,
      [from]: rules[from].filter((r) => r !== rule),
      [to]: rules[to].includes(rule) ? rules[to] : [...rules[to], rule],
    })
  }

  // Codex uses a different model (approval policy + sandbox), not allow/deny/ask.
  if (agent.id === 'codex') return <CodexApprovals />

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Permissions" icon="shield" />
        <EmptyState
          icon="shield"
          title={`${agent.displayName} has no permission rules`}
          description="Switch to an agent that exposes tool permissions to edit them here."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Permissions" icon="shield" />
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings to manage permissions."
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              Open Settings
            </Button>
          }
        />
      </div>
    )
  }

  const sections: {
    key: PermissionColumn
    title: string
    description: string
    placeholder: string
    icon: string
    /** Top-border accent communicating the risk level of the column. */
    accent: string
    iconClass: string
    countVariant: 'success' | 'warning' | 'danger'
  }[] = [
    {
      key: 'allow',
      title: 'Allow',
      description: 'Tools the agent may run without asking.',
      placeholder: 'Bash(npm run test:*)',
      icon: 'circle-check',
      accent: 'border-t-2 border-t-success/60',
      iconClass: 'text-success',
      countVariant: 'success',
    },
    {
      key: 'ask',
      title: 'Ask',
      description: 'Tools that require confirmation first.',
      placeholder: 'Bash(git push:*)',
      icon: 'circle-help',
      accent: 'border-t-2 border-t-warning/60',
      iconClass: 'text-warning',
      countVariant: 'warning',
    },
    {
      key: 'deny',
      title: 'Deny',
      description: 'Tools that are always blocked — your wall against accidents.',
      placeholder: 'Read(./.env)',
      icon: 'shield-x',
      accent: 'border-t-2 border-t-destructive/70',
      iconClass: 'text-destructive',
      countVariant: 'danger',
    },
  ]

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Permissions"
        description={`Tool permission rules for ${agent.displayName}`}
        icon="shield"
        actions={<PermissionPresets rules={rules} onChange={persist} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {hasInherited && (
          <div className="flex items-center rounded-md border border-border p-0.5">
            {(['own', 'effective'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors',
                  view === v
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'own' ? 'Own' : 'Effective'}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rules…"
            className="h-9 w-[180px] pl-8"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="arrow-up-down" />
              Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label}
              <Icon name="chevron-down" className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.value} onSelect={() => setSort(o.value)}>
                <Icon
                  name="check"
                  className={cn('size-3.5', sort !== o.value && 'opacity-0')}
                />
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PermissionTester rules={showEffective ? effective : rules} />
        <PermissionShare rules={rules} onChange={persist} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings-file')}
        >
          <Icon name="braces" />
          View as JSON
        </Button>
      </div>

      {conflictCount > 0 && !showEffective && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Icon name="circle-alert" className="size-4 shrink-0" />
          <span>
            {conflictCount} rule{conflictCount === 1 ? '' : 's'} appear in more
            than one column. Claude Code applies deny &gt; ask &gt; allow, so the
            stricter column wins.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 overflow-y-auto">
        {allEmpty && (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3">
            <Icon name="sparkles" className="size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">No rules yet</p>
              <p className="text-xs text-muted-foreground">
                Start from a security preset, then fine-tune it below.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const standard = SECURITY_PRESETS.find((p) => p.id === 'standard')
                if (standard)
                  persist({
                    ...standard.rules,
                    defaultMode: rules.defaultMode,
                    additionalDirectories: rules.additionalDirectories,
                  })
              }}
            >
              <Icon name="shield-check" />
              Apply Standard preset
            </Button>
          </div>
        )}

        {!showEffective && (
          <div className="grid gap-4 md:grid-cols-2">
            <PermissionMode
              mode={rules.defaultMode}
              onChange={(defaultMode) => persist({ ...rules, defaultMode })}
            />
            <AdditionalDirectories
              dirs={rules.additionalDirectories ?? []}
              onChange={(additionalDirectories) =>
                persist({ ...rules, additionalDirectories })
              }
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => {
            const count = viewRules[section.key].length
            const globalCount = shownInherited[section.key].length
            return (
              <Card key={section.key} className={section.accent}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon
                      name={section.icon}
                      className={`size-4 ${section.iconClass}`}
                    />
                    {section.title}
                    <span className="ml-auto flex items-center gap-1">
                      <Badge variant={section.countVariant}>{count}</Badge>
                      {!showEffective && globalCount > 0 && (
                        <Badge variant="muted">+{globalCount} global</Badge>
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {showEffective
                      ? 'Effective rules — global merged with this project.'
                      : section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PermissionRuleEditor
                    category={section.key}
                    values={viewRules[section.key]}
                    inherited={showEffective ? [] : shownInherited[section.key]}
                    filter={deferredQuery}
                    sort={sort}
                    conflicts={showEffective ? undefined : conflicts}
                    mcpServers={mcpServers}
                    relativeBase={projectDir}
                    readOnly={showEffective}
                    onChange={(values) =>
                      persist({ ...rules, [section.key]: values })
                    }
                    onMove={(rule, target) => move(section.key, rule, target)}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
