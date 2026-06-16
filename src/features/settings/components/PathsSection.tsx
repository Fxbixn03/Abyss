import { useEffect, useState } from 'react'
import type { AgentAdapter, AgentInstallStatus } from '@/shared/types/agent'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Switch } from '@/shared/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { formatDateTime, type DateTimeFormat } from '@/shared/lib/datetime'

/** Fixed sample timestamp for the date-format preview (kept pure for render). */
const SAMPLE_DATE = new Date(2026, 5, 16, 14, 30)
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '../hooks/useBasePath'
import { useSettingsStore } from '../store/settings.store'

function AgentPaths({ agent }: { agent: AgentAdapter }) {
  const detected = useSettingsStore((s) => s.detected[agent.id]) ?? []
  const override = useSettingsStore((s) => s.settings.agentPaths[agent.id])
  const setAgentPath = useSettingsStore((s) => s.setAgentPath)
  const redetect = useSettingsStore((s) => s.redetect)
  const effective = useBasePath(agent.id)

  const [install, setInstall] = useState<AgentInstallStatus | null>(null)
  useEffect(() => {
    let active = true
    void ipc.agentInstallStatus(agent.id).then((s) => {
      if (active) setInstall(s)
    })
    return () => {
      active = false
    }
  }, [agent.id])

  const overrideActive = Boolean(override && override.trim() !== '')
  const overrideInDetected = detected.some((d) => d.path === override)

  const create = async (path: string) => {
    await ipc.createDirectory(path)
    await redetect(agent.id)
  }

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
          {install &&
            (install.installed ? (
              <Badge variant="success" className="font-code">
                {install.version ?? 'installed'}
              </Badge>
            ) : (
              <Badge variant="muted">CLI not found</Badge>
            ))}
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
              onCreate={
                candidate.exists ? undefined : () => void create(candidate.path)
              }
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
  onCreate?: () => void
}

function PathRow({
  path,
  exists,
  active,
  custom = false,
  onUse,
  onClear,
  onCreate,
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
        className={cn(
          'size-4 shrink-0',
          exists ? 'text-success' : 'text-warning',
        )}
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
      {onCreate && (
        <Button variant="ghost" size="sm" onClick={onCreate}>
          <Icon name="folder-plus" />
          Create
        </Button>
      )}
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

function DetectionControls() {
  const autoDetect = useSettingsStore((s) => s.settings.autoDetectPaths)
  const dateFormat = useSettingsStore((s) => s.settings.dateTimeFormat)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)
  const redetect = useSettingsStore((s) => s.redetect)

  const onToggle = async (value: boolean) => {
    await updatePrefs({ autoDetectPaths: value })
    if (value) {
      await redetect()
    } else {
      // Stop relying on scanned locations immediately.
      useSettingsStore.setState({ detected: {} })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detection &amp; formatting</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Auto-detect config paths</p>
            <p className="text-xs text-muted-foreground">
              Scan known locations on disk automatically. When off, only your
              explicit paths below are used.
            </p>
          </div>
          <Switch
            checked={autoDetect}
            onCheckedChange={(v) => void onToggle(v)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Date &amp; time format</p>
            <p className="text-xs text-muted-foreground">
              How absolute dates appear across the app — e.g.{' '}
              {formatDateTime(SAMPLE_DATE, dateFormat)}.
            </p>
          </div>
          <Select
            value={dateFormat}
            onValueChange={(v) =>
              void updatePrefs({ dateTimeFormat: v as DateTimeFormat })
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="locale">System locale</SelectItem>
              <SelectItem value="iso">ISO (2026-06-16 14:30)</SelectItem>
              <SelectItem value="us">US (06/16/2026 14:30)</SelectItem>
              <SelectItem value="eu">EU (16.06.2026 14:30)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

export function PathsSection() {
  const agents = useAllAgents()
  return (
    <div className="flex flex-col gap-4">
      <DetectionControls />
      {agents.map((agent) => (
        <AgentPaths key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
