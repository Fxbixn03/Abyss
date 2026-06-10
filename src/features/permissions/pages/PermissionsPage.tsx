import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PermissionRules } from '@/shared/types/config'
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
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase, useScope } from '@/features/scope/hooks/useScopedBase'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { CodexApprovals } from '../components/CodexApprovals'
import { PermissionRuleEditor } from '../components/PermissionRuleEditor'
import { PermissionPresets } from '../components/PermissionPresets'
import { PermissionTester } from '../components/PermissionTester'
import { buildConflictMap, findConflicts } from '../lib/conflicts'

const EMPTY: PermissionRules = { allow: [], deny: [], ask: [] }

export function PermissionsPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const globalBase = useBasePath(agent.id)
  const { scope } = useScope()
  const navigate = useNavigate()
  const supported = agent.capabilities.permissions

  const [rules, setRules] = useState<PermissionRules>(EMPTY)
  // Rules from the global profile, surfaced read-only when editing a project.
  const [inherited, setInherited] = useState<PermissionRules>(EMPTY)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

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

  // Inherited rules only apply when overriding the global profile in a project.
  const shownInherited = scope === 'project' ? inherited : EMPTY

  const conflicts = useMemo(() => buildConflictMap(rules), [rules])
  const conflictCount = useMemo(() => findConflicts(rules).length, [rules])

  const persist = (next: PermissionRules) => {
    setRules(next)
    if (basePath) void ipc.setPermissions(agent.id, basePath, next)
  }

  const move = (
    from: keyof PermissionRules,
    rule: string,
    to: keyof PermissionRules,
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
    key: keyof PermissionRules
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
        actions={
          <>
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
            <PermissionTester rules={rules} />
            <PermissionPresets rules={rules} onChange={persist} />
          </>
        }
      />

      {conflictCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Icon name="circle-alert" className="size-4 shrink-0" />
          <span>
            {conflictCount} rule{conflictCount === 1 ? '' : 's'} appear in more
            than one column. Claude Code applies deny &gt; ask &gt; allow, so the
            stricter column wins.
          </span>
        </div>
      )}

      <div className="grid gap-4 overflow-y-auto md:grid-cols-3">
        {sections.map((section) => {
          const ownCount = rules[section.key].length
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
                    <Badge variant={section.countVariant}>{ownCount}</Badge>
                    {globalCount > 0 && (
                      <Badge variant="muted">+{globalCount} global</Badge>
                    )}
                  </span>
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <PermissionRuleEditor
                  category={section.key}
                  values={rules[section.key]}
                  inherited={shownInherited[section.key]}
                  filter={deferredQuery}
                  conflicts={conflicts}
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
  )
}
