import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { KeyValueEditor } from '@/shared/components/KeyValueEditor'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import type { CustomAgentSpec } from '@/shared/agents/custom-agent'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useAgentStore } from '@/features/agents/store/agent.store'
import {
  isAgentEnabled,
  useAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
import { useAgentInstalled } from '@/features/agents/store/agent-availability.store'
import { useCustomAgentStore } from '@/features/agents/store/custom-agent.store'
import { useBasePath } from '../hooks/useBasePath'
import { AgentAvatar } from '@/features/agents/components/AgentAvatar'
import { CustomAgentDialog } from './CustomAgentDialog'

/**
 * Per-agent environment-variable editor for the Agents tab. Loads the agent's
 * model+env from its global config base, edits only the env map (model is left
 * untouched), and saves through the existing model-env IPC path.
 */
function AgentEnvEditor({ agentId }: { agentId: string }) {
  const basePath = useBasePath(agentId)
  const [model, setModel] = useState<string | undefined>()
  const [env, setEnv] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!basePath) return
    let active = true
    void ipc.getModelEnv(agentId, basePath).then((config) => {
      if (!active) return
      setModel(config.model)
      setEnv(config.env)
      setDirty(false)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [agentId, basePath])

  const save = async () => {
    if (!basePath) return
    setSaving(true)
    await ipc.setModelEnv(agentId, basePath, { model, env })
    setSaving(false)
    setDirty(false)
  }

  if (!basePath) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        Set a config location for this agent first (Config Paths tab).
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
      {!loaded ? (
        <Spinner label="Loading…" />
      ) : (
        <>
          <KeyValueEditor
            value={env}
            onChange={(next) => {
              setEnv(next)
              setDirty(true)
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
              <Icon name="save" />
              {saving ? 'Saving…' : 'Save env'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function AgentRow({
  agentId,
  custom,
  onEdit,
  onDelete,
}: {
  agentId: string
  custom?: CustomAgentSpec
  onEdit?: () => void
  onDelete?: () => void
}) {
  const agent = agentRegistry.get(agentId)
  const enabledMap = useAgentEnabled((s) => s.enabled)
  const setEnabled = useAgentEnabled((s) => s.setEnabled)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const installed = useAgentInstalled(agentId)
  const [confirming, setConfirming] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const supportsEnv = agent.capabilities.modelEnv

  const on = isAgentEnabled(enabledMap, agentId)
  const enabledCount = agentRegistry
    .getAll()
    .filter((a) => isAgentEnabled(enabledMap, a.id)).length
  // Don't let the user disable the last enabled agent.
  const lastOne = on && enabledCount <= 1

  const toggle = (next: boolean) => {
    if (!next && lastOne) return
    setEnabled(agentId, next)
    // If we just disabled the active agent, switch to another enabled one.
    if (!next && activeAgentId === agentId) {
      const fallback = agentRegistry
        .getAll()
        .find((a) => a.id !== agentId && isAgentEnabled(enabledMap, a.id))
      if (fallback) setActiveAgent(fallback.id)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
      <div className="flex items-center gap-3">
      <AgentAvatar agent={agent} className="size-8" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.displayName}</span>
          {custom ? (
            <Badge variant="muted">custom</Badge>
          ) : installed ? (
            <Badge variant="success" className="font-code">
              installed
            </Badge>
          ) : (
            <Badge variant="muted">not installed</Badge>
          )}
        </div>
        <span className="font-code text-xs text-muted-foreground">
          {agent.id}
        </span>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete?.()
              setConfirming(false)
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          {supportsEnv && (
            <Button
              variant={envOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setEnvOpen((o) => !o)}
              aria-label={`Environment variables for ${agent.displayName}`}
            >
              <Icon name="sliders" />
              Env
            </Button>
          )}
          {custom && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${agent.displayName}`}
                onClick={onEdit}
              >
                <Icon name="pencil" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${agent.displayName}`}
                onClick={() => setConfirming(true)}
              >
                <Icon name="trash" className="text-destructive" />
              </Button>
            </>
          )}
          <Switch
            checked={on}
            disabled={lastOne}
            onCheckedChange={toggle}
            aria-label={`Toggle ${agent.displayName}`}
          />
        </>
      )}
      </div>
      {supportsEnv && envOpen && <AgentEnvEditor agentId={agentId} />}
    </div>
  )
}

export function AgentsSection() {
  // Subscribe to the custom specs so new/edited/removed agents re-render the list.
  const specs = useCustomAgentStore((s) => s.specs)
  const remove = useCustomAgentStore((s) => s.remove)
  const customIds = new Set(specs.map((s) => s.id))

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomAgentSpec | null>(null)

  const builtinIds = agentRegistry
    .getAll()
    .map((a) => a.id)
    .filter((id) => !customIds.has(id))

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (spec: CustomAgentSpec) => {
    setEditing(spec)
    setDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>
          Choose which agents appear in the app. Disabled agents are hidden
          everywhere (switcher, sidebar, compare, …). The last enabled agent
          can&apos;t be turned off. Add your own agent with the button below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {builtinIds.map((id) => (
          <AgentRow key={id} agentId={id} />
        ))}

        {specs.map((spec) => (
          <AgentRow
            key={spec.id}
            agentId={spec.id}
            custom={spec}
            onEdit={() => openEdit(spec)}
            onDelete={() => void remove(spec.id)}
          />
        ))}

        <button
          type="button"
          onClick={openCreate}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm font-medium text-muted-foreground transition-colors',
            'hover:border-primary/50 hover:bg-accent/50 hover:text-foreground',
          )}
        >
          <Icon name="plus" className="size-4" />
          Create a custom agent
        </button>
      </CardContent>

      {dialogOpen && (
        <CustomAgentDialog
          // Remount per target so the form initializes from the right spec.
          key={editing?.id ?? '__new__'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
        />
      )}
    </Card>
  )
}
