import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { KeyValueEditor } from '@/shared/components/KeyValueEditor'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '@/features/settings/hooks/useBasePath'

export function ModelEnvPage() {
  const agent = useActiveAgent()
  const basePath = useBasePath(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.modelEnv

  const [model, setModel] = useState('')
  const [env, setEnv] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.getModelEnv(agent.id, basePath).then((config) => {
      if (!active) return
      setModel(config.model ?? '')
      setEnv(config.env)
      setDirty(false)
    })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath])

  const save = async () => {
    if (!basePath) return
    setSaving(true)
    await ipc.setModelEnv(agent.id, basePath, { model, env })
    setSaving(false)
    setDirty(false)
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Model & Env" icon="sliders" />
        <EmptyState
          icon="sliders"
          title={`${agent.displayName} has no model settings`}
          description="Switch to an agent that supports model and environment configuration."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Model & Env" icon="sliders" />
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings first."
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

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Model & Env"
        description={`Default model and environment for ${agent.displayName}`}
        icon="sliders"
        actions={
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="grid gap-4 overflow-y-auto lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="cpu" className="size-4" />
              Model
            </CardTitle>
            <CardDescription>
              Default model identifier the agent should use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setDirty(true)
                }}
                placeholder="claude-sonnet-4-6"
                className="font-code"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="sliders" className="size-4" />
              Environment variables
            </CardTitle>
            <CardDescription>
              Injected into the agent's environment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueEditor
              value={env}
              onChange={(next) => {
                setEnv(next)
                setDirty(true)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
