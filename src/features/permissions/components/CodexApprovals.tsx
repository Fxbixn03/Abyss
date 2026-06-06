import { useEffect, useState } from 'react'
import type {
  CodexApprovalPolicy,
  CodexSandboxMode,
  CodexSettings,
} from '@/shared/types/config'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'

const APPROVAL_OPTIONS: { value: CodexApprovalPolicy; label: string }[] = [
  { value: 'untrusted', label: 'Untrusted — approve all but trusted commands' },
  { value: 'on-failure', label: 'On failure — ask only when a command fails' },
  { value: 'on-request', label: 'On request — the agent asks when needed' },
  { value: 'never', label: 'Never — fully autonomous (no prompts)' },
]

const SANDBOX_OPTIONS: { value: CodexSandboxMode; label: string }[] = [
  { value: 'read-only', label: 'Read-only — no edits or commands' },
  {
    value: 'workspace-write',
    label: 'Workspace write — edit & run in workspace',
  },
  {
    value: 'danger-full-access',
    label: 'Full access — no sandbox (dangerous)',
  },
]

const DEFAULTS: CodexSettings = {
  approvalPolicy: 'on-request',
  sandboxMode: 'workspace-write',
  networkAccess: false,
}

export function CodexApprovals() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const [settings, setSettings] = useState<CodexSettings>(DEFAULTS)

  useEffect(() => {
    if (!basePath) return
    let active = true
    void ipc.getCodexSettings(basePath).then((s) => {
      if (active) setSettings(s)
    })
    return () => {
      active = false
    }
  }, [basePath])

  const persist = (next: CodexSettings) => {
    setSettings(next)
    if (basePath) void ipc.setCodexSettings(basePath, next)
  }

  const header = (
    <PageHeader
      title="Approvals & Sandbox"
      description={`How ${agent.displayName} asks for approval and sandboxes its actions`}
      icon="shield"
    />
  )

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        {header}
        <EmptyState
          icon="folder"
          title="No config location"
          description="Pick a project or check the Codex install to edit approvals."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {header}
      <div className="grid gap-4 overflow-y-auto md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="shield" className="size-4" />
              Approval policy
            </CardTitle>
            <CardDescription>
              When Codex pauses to ask you before acting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.approvalPolicy}
              onValueChange={(v) =>
                persist({
                  ...settings,
                  approvalPolicy: v as CodexApprovalPolicy,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="shield" className="size-4" />
              Sandbox mode
            </CardTitle>
            <CardDescription>
              How much access Codex&apos;s commands have.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={settings.sandboxMode}
              onValueChange={(v) =>
                persist({ ...settings, sandboxMode: v as CodexSandboxMode })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SANDBOX_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Network access</span>
                <span className="text-xs text-muted-foreground">
                  Allow network in the workspace-write sandbox.
                </span>
              </span>
              <Switch
                checked={settings.networkAccess}
                onCheckedChange={(checked) =>
                  persist({ ...settings, networkAccess: checked })
                }
              />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
