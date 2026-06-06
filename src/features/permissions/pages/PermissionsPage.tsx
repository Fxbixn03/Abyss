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
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { CodexApprovals } from '../components/CodexApprovals'
import { PermissionRuleEditor } from '../components/PermissionRuleEditor'

const EMPTY: PermissionRules = { allow: [], deny: [], ask: [] }

export function PermissionsPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.permissions

  const [rules, setRules] = useState<PermissionRules>(EMPTY)

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
  }[] = [
    {
      key: 'allow',
      title: 'Allow',
      description: 'Tools the agent may run without asking.',
      placeholder: 'Bash(npm run test:*)',
    },
    {
      key: 'ask',
      title: 'Ask',
      description: 'Tools that require confirmation first.',
      placeholder: 'Bash(git push:*)',
    },
    {
      key: 'deny',
      title: 'Deny',
      description: 'Tools that are always blocked.',
      placeholder: 'Read(./.env)',
    },
  ]

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Permissions"
        description={`Tool permission rules for ${agent.displayName}`}
        icon="shield"
      />
      <div className="grid gap-4 overflow-y-auto md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="shield" className="size-4" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionRuleEditor
                category={section.key}
                values={rules[section.key]}
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
