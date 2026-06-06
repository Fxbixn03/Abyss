import { useEffect, useState } from 'react'
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

  const persist = (next: PermissionRules) => {
    setRules(next)
    if (basePath) void ipc.setPermissions(agent.id, basePath, next)
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
  }[] = [
    {
      key: 'allow',
      title: 'Allow',
      description: 'Tools the agent may run without asking.',
      placeholder: 'Bash(npm run test:*)',
      icon: 'circle-check',
      accent: 'border-t-2 border-t-success/60',
      iconClass: 'text-success',
    },
    {
      key: 'ask',
      title: 'Ask',
      description: 'Tools that require confirmation first.',
      placeholder: 'Bash(git push:*)',
      icon: 'circle-help',
      accent: 'border-t-2 border-t-warning/60',
      iconClass: 'text-warning',
    },
    {
      key: 'deny',
      title: 'Deny',
      description: 'Tools that are always blocked — your wall against accidents.',
      placeholder: 'Read(./.env)',
      icon: 'shield-x',
      accent: 'border-t-2 border-t-destructive/70',
      iconClass: 'text-destructive',
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
      <div className="grid gap-4 overflow-y-auto md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.key} className={section.accent}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon
                  name={section.icon}
                  className={`size-4 ${section.iconClass}`}
                />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionRuleEditor
                category={section.key}
                values={rules[section.key]}
                inherited={shownInherited[section.key]}
                onChange={(values) =>
                  persist({ ...rules, [section.key]: values })
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
