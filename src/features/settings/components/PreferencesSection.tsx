import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
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
                      void updatePrefs({ currency: v as 'usd' | 'eur' })
                    }
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </>
          )}
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
