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
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import type { SpinnerVerbsMode } from '@/shared/types/spinner'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useSpinnerStore } from '../store/spinner.store'
import { StringListEditor } from '../components/StringListEditor'

const SNAPSHOT_KEYS = [
  'verbsMode',
  'verbs',
  'tips',
  'tipsExcludeDefault',
] as const

export function SpinnerPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  // spinnerVerbs / spinnerTipsOverride are Claude Code settings.json keys.
  const supported = agent.id === 'claude'

  const config = useSpinnerStore((s) => s.config)
  const saved = useSpinnerStore((s) => s.saved)
  const saving = useSpinnerStore((s) => s.saving)
  const load = useSpinnerStore((s) => s.load)
  const update = useSpinnerStore((s) => s.update)
  const save = useSpinnerStore((s) => s.save)

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

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Spinner" icon="loader" />
        <EmptyState
          icon="loader"
          title={`${agent.displayName} has no spinner customization`}
          description="Custom spinner verbs and tips are specific to Claude Code. Switch to Claude to configure them."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Spinner" icon="loader" />
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
        title="Spinner"
        description="Customize the action verbs and tips Claude Code shows while it works"
        icon="loader"
        actions={
          <div className="flex items-center gap-2">
            {dirty && <Badge variant="warning">Unsaved</Badge>}
            <Button onClick={() => void save(basePath)} disabled={!dirty || saving}>
              <Icon name={saving ? 'loader' : 'save'} className={saving ? 'animate-spin' : ''} />
              Save
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Action verbs</CardTitle>
                <CardDescription>
                  The word shown next to the spinner (e.g. “Crafting…”).
                </CardDescription>
              </div>
              <div className="w-40 shrink-0 space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={config.verbsMode}
                  onValueChange={(v) =>
                    update({ verbsMode: v as SpinnerVerbsMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append to defaults</SelectItem>
                    <SelectItem value="replace">Replace defaults</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StringListEditor
              items={config.verbs}
              onChange={(verbs) => update({ verbs })}
              placeholder="e.g. Pondering"
            />
            {config.verbs.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No custom verbs — Claude Code uses its built-in set.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
            <CardDescription>
              Hints shown beneath the spinner during longer turns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StringListEditor
              items={config.tips}
              onChange={(tips) => update({ tips })}
              placeholder="e.g. Use our internal tool X"
            />
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="exclude-default">Show only custom tips</Label>
                <p className="text-xs text-muted-foreground">
                  Hide Claude Code’s built-in tips (`excludeDefault`).
                </p>
              </div>
              <Switch
                id="exclude-default"
                checked={config.tipsExcludeDefault}
                onCheckedChange={(v) => update({ tipsExcludeDefault: v })}
                disabled={config.tips.length === 0}
              />
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Written to <code className="font-code">spinnerVerbs</code> and{' '}
          <code className="font-code">spinnerTipsOverride</code> in Claude Code’s
          settings.json. Clearing a list removes its key.
        </p>
      </div>
    </div>
  )
}
