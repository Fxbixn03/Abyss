import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useTourStore } from '@/features/tour/store/tour.store'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useSettingsStore } from '../store/settings.store'

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function PreferencesSection() {
  const settings = useSettingsStore((s) => s.settings)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)
  const startTour = useTourStore((s) => s.start)
  const navigate = useNavigate()
  const agents = useAllAgents()

  const browseProjectDir = async () => {
    const { path } = await ipc.pickDirectory(
      'Default project directory',
      settings.defaultProjectDir,
    )
    if (path) await updatePrefs({ defaultProjectDir: path })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title="Confirm with a diff before saving"
            description="Review changes against the on-disk file before writing."
            control={
              <Switch
                checked={settings.confirmDiffBeforeSave}
                onCheckedChange={(v) =>
                  void updatePrefs({ confirmDiffBeforeSave: v })
                }
              />
            }
          />
          <SettingRow
            title="Launch on startup"
            description="Start Abyss when you log in (applied on next launch)."
            control={
              <Switch
                checked={settings.launchOnStartup}
                onCheckedChange={(v) =>
                  void updatePrefs({ launchOnStartup: v })
                }
              />
            }
          />
          <SettingRow
            title="Autosave"
            description="Automatically save the open config file after the configured idle period."
            control={
              <Switch
                checked={settings.autosave}
                onCheckedChange={(v) => void updatePrefs({ autosave: v })}
              />
            }
          />
          {settings.autosave && (
            <SettingRow
              title="Autosave delay"
              description="Idle time (in seconds) before the file is saved automatically (1–30)."
              control={
                <Input
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={settings.autosaveDelaySeconds}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    const clamped = Math.min(30, Math.max(1, raw || 1))
                    void updatePrefs({ autosaveDelaySeconds: clamped })
                  }}
                  className="w-[80px] text-right font-code"
                />
              }
            />
          )}
          <SettingRow
            title="Editor line wrap"
            description="Wrap long lines in the config editor instead of scrolling horizontally."
            control={
              <Switch
                checked={settings.editorLineWrap}
                onCheckedChange={(v) => void updatePrefs({ editorLineWrap: v })}
              />
            }
          />
          <SettingRow
            title="Guided tour"
            description="Replay the short walkthrough of the main areas of Abyss."
            control={
              <Button variant="secondary" size="sm" onClick={startTour}>
                <Icon name="graduation-cap" />
                Replay tour
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Startup &amp; language</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title="Agent on startup"
            description="Which agent Abyss opens with. “Last used” restores your most recent agent."
            control={
              <Select
                value={settings.startupAgentId ?? '__last__'}
                onValueChange={(v) =>
                  void updatePrefs({
                    startupAgentId: v === '__last__' ? undefined : v,
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__last__">Last used agent</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title="Language"
            description="Interface language. More languages are coming; English is the default for now."
            control={
              <Select
                value={settings.language}
                onValueChange={(v) => void updatePrefs({ language: v })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing &amp; cost</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title="Billing mode"
            description="Subscription has no per-token cost; API is pay-as-you-go."
            control={
              <Select
                value={settings.billingMode}
                onValueChange={(v) =>
                  void updatePrefs({
                    billingMode: v as 'subscription' | 'api',
                  })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="api">API (pay-as-you-go)</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          {settings.billingMode === 'api' && (
            <>
              <SettingRow
                title="Show estimated costs"
                description="Display an approximate token cost on the dashboard."
                control={
                  <Switch
                    checked={settings.showCosts}
                    onCheckedChange={(v) => void updatePrefs({ showCosts: v })}
                  />
                }
              />
              <SettingRow
                title="Currency"
                description="Currency used for the cost estimate."
                control={
                  <Select
                    value={settings.currency}
                    onValueChange={(v) =>
                      void updatePrefs({
                        currency: v as 'usd' | 'eur' | 'gbp' | 'cad' | 'jpy',
                      })
                    }
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                      <SelectItem value="cad">CAD (C$)</SelectItem>
                      <SelectItem value="jpy">JPY (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Usage limits</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/usage')}
          >
            <Icon name="bar-chart-3" />
            View usage
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title="Weekly token budget"
            description="Your plan's weekly allowance — drives the % quota gauge on the dashboard."
            control={
              <Input
                type="number"
                min={0}
                step={100000}
                value={settings.weeklyTokenBudget ?? ''}
                placeholder="e.g. 5000000"
                onChange={(e) =>
                  void updatePrefs({
                    weeklyTokenBudget: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="w-[160px] text-right font-code"
              />
            }
          />
          <SettingRow
            title="Session (5h) token budget"
            description="Rolling 5-hour allowance, shown as a percentage consumed."
            control={
              <Input
                type="number"
                min={0}
                step={50000}
                value={settings.sessionTokenBudget ?? ''}
                placeholder="e.g. 1000000"
                onChange={(e) =>
                  void updatePrefs({
                    sessionTokenBudget: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="w-[160px] text-right font-code"
              />
            }
          />
          <SettingRow
            title="Budget alert threshold"
            description="Warn on the usage gauge once consumption reaches this percentage (0 = off)."
            control={
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.budgetAlertPercent ?? ''}
                  placeholder="80"
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    void updatePrefs({
                      budgetAlertPercent: e.target.value
                        ? Math.min(100, Math.max(0, raw))
                        : undefined,
                    })
                  }}
                  className="w-[80px] text-right font-code"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default project directory</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {settings.defaultProjectDir ? (
            <button
              type="button"
              onClick={() => void ipc.revealPath(settings.defaultProjectDir!)}
              data-selectable
              className="min-w-0 flex-1 truncate text-left font-code text-xs text-muted-foreground hover:text-foreground"
            >
              {settings.defaultProjectDir}
            </button>
          ) : (
            <span className="flex-1">
              <Badge variant="muted">not set</Badge>
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void browseProjectDir()}
          >
            <Icon name="folder-open" />
            Browse…
          </Button>
          {settings.defaultProjectDir && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void updatePrefs({ defaultProjectDir: undefined })}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
