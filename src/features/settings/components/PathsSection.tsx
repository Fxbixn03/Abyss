import type { AgentAdapter } from '@/shared/types/agent'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '../hooks/useBasePath'
import { useSettingsStore } from '../store/settings.store'

function AgentPaths({ agent }: { agent: AgentAdapter }) {
  const detected = useSettingsStore((s) => s.detected[agent.id]) ?? []
  const override = useSettingsStore((s) => s.settings.agentPaths[agent.id])
  const setAgentPath = useSettingsStore((s) => s.setAgentPath)
  const redetect = useSettingsStore((s) => s.redetect)
  const effective = useBasePath(agent.id)

  const overrideActive = Boolean(override && override.trim() !== '')
  const overrideInDetected = detected.some((d) => d.path === override)

  const browse = async () => {
    const { path } = await ipc.pickDirectory(
      `Choose config directory for ${agent.displayName}`,
      effective || undefined,
    )
    if (path) await setAgentPath(agent.id, path)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Icon name={agent.icon} className="size-4" />
          {agent.displayName}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void redetect(agent.id)}
          >
            <Icon name="refresh-cw" />
            Re-detect
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void browse()}>
            <Icon name="folder-open" />
            Browse…
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {detected.map((candidate) => {
          const active = candidate.path === effective
          return (
            <PathRow
              key={candidate.path}
              path={candidate.path}
              exists={candidate.exists}
              active={active}
              onUse={() => void setAgentPath(agent.id, candidate.path)}
            />
          )
        })}

        {overrideActive && !overrideInDetected && override && (
          <PathRow
            path={override}
            exists
            active={override === effective}
            custom
            onClear={() => void setAgentPath(agent.id, '')}
          />
        )}

        {detected.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No known locations for this agent.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface PathRowProps {
  path: string
  exists: boolean
  active: boolean
  custom?: boolean
  onUse?: () => void
  onClear?: () => void
}

function PathRow({
  path,
  exists,
  active,
  custom = false,
  onUse,
  onClear,
}: PathRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2',
        active ? 'border-primary/50 bg-accent/60' : 'border-border',
      )}
    >
      <Icon
        name={exists ? 'circle-check' : 'alert-triangle'}
        className={cn('size-4 shrink-0', exists ? 'text-success' : 'text-warning')}
      />
      <button
        type="button"
        onClick={() => void ipc.revealPath(path)}
        title="Reveal in file manager"
        data-selectable
        className="min-w-0 flex-1 truncate text-left font-code text-xs hover:text-foreground"
      >
        {path}
      </button>
      {custom && <Badge variant="muted">custom</Badge>}
      {active ? (
        <Badge variant="success">active</Badge>
      ) : (
        onUse && (
          <Button variant="ghost" size="sm" onClick={onUse}>
            Use
          </Button>
        )
      )}
      {custom && onClear && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Clear custom path"
        >
          <Icon name="x" />
        </Button>
      )}
    </div>
  )
}

export function PathsSection() {
  const agents = useAllAgents()
  return (
    <div className="flex flex-col gap-4">
      {agents.map((agent) => (
        <AgentPaths key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
