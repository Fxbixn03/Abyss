import { useEffect, useMemo } from 'react'
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
import { Switch } from '@/shared/components/ui/switch'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import type { StatusLineSegmentId } from '@/shared/types/statusline'
import {
  SEGMENT_DEFS,
  getSegmentDef,
  renderStatusLine,
} from '@/shared/statusline/segments'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useStatusLineStore } from '../store/statusline.store'

const SNAPSHOT_KEYS = [
  'segments',
  'separator',
  'padding',
  'dirBasename',
  'icons',
] as const

export function StatusLinePage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.statusLine === true

  const config = useStatusLineStore((s) => s.config)
  const saved = useStatusLineStore((s) => s.saved)
  const saving = useStatusLineStore((s) => s.saving)
  const load = useStatusLineStore((s) => s.load)
  const update = useStatusLineStore((s) => s.update)
  const save = useStatusLineStore((s) => s.save)
  const remove = useStatusLineStore((s) => s.remove)

  useEffect(() => {
    if (supported && basePath) void load(basePath)
  }, [supported, basePath, load])

  const dirty = useMemo(
    () =>
      SNAPSHOT_KEYS.some(
        (k) => JSON.stringify(config[k]) !== JSON.stringify(saved[k]),
      ),
    [config, saved],
  )

  const preview = useMemo(() => renderStatusLine(config), [config])

  const available = useMemo(
    () => SEGMENT_DEFS.filter((d) => !config.segments.includes(d.id)),
    [config.segments],
  )

  const addSegment = (id: StatusLineSegmentId) =>
    update({ segments: [...config.segments, id] })

  const removeSegment = (id: StatusLineSegmentId) =>
    update({ segments: config.segments.filter((s) => s !== id) })

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.segments]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ segments: next })
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Status Line" icon="terminal" />
        <EmptyState
          icon="terminal"
          title={`${agent.displayName} has no status line`}
          description="The status line builder is specific to Claude Code. Switch to Claude to configure it."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Status Line" icon="terminal" />
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
        title="Status Line"
        description={`The bottom status bar Claude Code renders for ${agent.displayName}`}
        icon="terminal"
        actions={
          <div className="flex items-center gap-2">
            {config.configured && (
              <Button
                variant="outline"
                onClick={() => void remove(basePath)}
                disabled={saving}
              >
                <Icon name="trash" />
                Remove
              </Button>
            )}
            <Button onClick={() => void save(basePath)} disabled={!dirty || saving}>
              <Icon name="save" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 overflow-y-auto pb-2">
        {config.configured && !config.managed && (
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <Icon name="triangle-alert" className="size-4" />
                A custom status line is already configured
              </CardTitle>
              <CardDescription>
                Abyss didn't generate the current status line. Saving below
                replaces it with the one you build here.
              </CardDescription>
            </CardHeader>
            {config.rawCommand && (
              <CardContent>
                <code className="block truncate rounded bg-muted px-2 py-1 font-code text-xs">
                  {config.rawCommand}
                </code>
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="eye" className="size-4" />
              Preview
            </CardTitle>
            <CardDescription>
              How the line renders for a sample session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-[#0b0b0e] px-3 py-2 font-code text-sm text-[#d4d4d8]">
              {preview || (
                <span className="text-muted-foreground">
                  Add a segment to see the status line.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="list-tree" className="size-4" />
              Segments
            </CardTitle>
            <CardDescription>
              Pick what to show and in which order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.segments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No segments yet — add some below.
              </p>
            ) : (
              <ul className="space-y-2">
                {config.segments.map((id, index) => {
                  const def = getSegmentDef(id)
                  if (!def) return null
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="w-5 text-center text-base">
                        {def.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{def.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {def.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label="Move up"
                        >
                          <Icon name="chevron-up" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => move(index, 1)}
                          disabled={index === config.segments.length - 1}
                          aria-label="Move down"
                        >
                          <Icon name="chevron-down" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSegment(id)}
                          aria-label="Remove segment"
                        >
                          <Icon name="x" className="size-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {available.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {available.map((def) => (
                  <Badge
                    key={def.id}
                    variant="outline"
                    className="cursor-pointer gap-1 py-1 hover:bg-accent"
                    onClick={() => addSegment(def.id)}
                  >
                    <Icon name="plus" className="size-3" />
                    {def.icon} {def.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="sliders" className="size-4" />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="separator">Separator</Label>
              <Input
                id="separator"
                value={config.separator}
                onChange={(e) => update({ separator: e.target.value })}
                placeholder="  "
                className="font-code"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="padding">Left padding</Label>
              <Input
                id="padding"
                type="number"
                min={0}
                value={config.padding}
                onChange={(e) =>
                  update({ padding: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Directory basename</div>
                <div className="text-xs text-muted-foreground">
                  Show only the last folder, not the full path.
                </div>
              </div>
              <Switch
                checked={config.dirBasename}
                onCheckedChange={(v) => update({ dirBasename: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Icons</div>
                <div className="text-xs text-muted-foreground">
                  Prefix each segment with a glyph.
                </div>
              </div>
              <Switch
                checked={config.icons}
                onCheckedChange={(v) => update({ icons: v })}
              />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
