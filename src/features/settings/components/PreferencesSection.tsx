import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { SUPPORTED_LANGUAGES } from '@/shared/i18n/languages'
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
  const { t } = useTranslation(['settings', 'common'])
  const settings = useSettingsStore((s) => s.settings)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)
  const startTour = useTourStore((s) => s.start)
  const navigate = useNavigate()
  const agents = useAllAgents()

  const browseProjectDir = async () => {
    const { path } = await ipc.pickDirectory(
      t('preferences.projectDir.pickerTitle'),
      settings.defaultProjectDir,
    )
    if (path) await updatePrefs({ defaultProjectDir: path })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.behaviour.title')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title={t('preferences.confirmDiff.title')}
            description={t('preferences.confirmDiff.desc')}
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
            title={t('preferences.launchOnStartup.title')}
            description={t('preferences.launchOnStartup.desc')}
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
            title={t('preferences.autosave.title')}
            description={t('preferences.autosave.desc')}
            control={
              <Switch
                checked={settings.autosave}
                onCheckedChange={(v) => void updatePrefs({ autosave: v })}
              />
            }
          />
          {settings.autosave && (
            <SettingRow
              title={t('preferences.autosaveDelay.title')}
              description={t('preferences.autosaveDelay.desc')}
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
            title={t('preferences.editorLineWrap.title')}
            description={t('preferences.editorLineWrap.desc')}
            control={
              <Switch
                checked={settings.editorLineWrap}
                onCheckedChange={(v) => void updatePrefs({ editorLineWrap: v })}
              />
            }
          />
          <SettingRow
            title={t('preferences.chatDensity.title')}
            description={t('preferences.chatDensity.desc')}
            control={
              <Select
                value={settings.chatDensity ?? 'comfortable'}
                onValueChange={(v) =>
                  void updatePrefs({
                    chatDensity: v as 'compact' | 'comfortable',
                  })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">
                    {t('preferences.chatDensity.comfortable')}
                  </SelectItem>
                  <SelectItem value="compact">
                    {t('preferences.chatDensity.compact')}
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title={t('preferences.guidedTour.title')}
            description={t('preferences.guidedTour.desc')}
            control={
              <Button variant="secondary" size="sm" onClick={startTour}>
                <Icon name="graduation-cap" />
                {t('preferences.guidedTour.replay')}
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.startupLanguage.title')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title={t('preferences.startupAgent.title')}
            description={t('preferences.startupAgent.desc')}
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
                  <SelectItem value="__last__">
                    {t('preferences.startupAgent.lastUsed')}
                  </SelectItem>
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
            title={t('preferences.language.title')}
            description={t('preferences.language.desc')}
            control={
              <Select
                value={settings.language}
                onValueChange={(v) => void updatePrefs({ language: v })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.billing.title')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title={t('preferences.billingMode.title')}
            description={t('preferences.billingMode.desc')}
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
                  <SelectItem value="subscription">
                    {t('preferences.billingMode.subscription')}
                  </SelectItem>
                  <SelectItem value="api">
                    {t('preferences.billingMode.api')}
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />
          {settings.billingMode === 'api' && (
            <>
              <SettingRow
                title={t('preferences.showCosts.title')}
                description={t('preferences.showCosts.desc')}
                control={
                  <Switch
                    checked={settings.showCosts}
                    onCheckedChange={(v) => void updatePrefs({ showCosts: v })}
                  />
                }
              />
              <SettingRow
                title={t('preferences.currency.title')}
                description={t('preferences.currency.desc')}
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
          <CardTitle>{t('preferences.usageLimits.title')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/usage')}
          >
            <Icon name="bar-chart-3" />
            {t('preferences.usageLimits.view')}
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            title={t('preferences.weeklyBudget.title')}
            description={t('preferences.weeklyBudget.desc')}
            control={
              <Input
                type="number"
                min={0}
                step={100000}
                value={settings.weeklyTokenBudget ?? ''}
                placeholder={t('preferences.weeklyBudget.placeholder')}
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
            title={t('preferences.sessionBudget.title')}
            description={t('preferences.sessionBudget.desc')}
            control={
              <Input
                type="number"
                min={0}
                step={50000}
                value={settings.sessionTokenBudget ?? ''}
                placeholder={t('preferences.sessionBudget.placeholder')}
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
            title={t('preferences.budgetAlert.title')}
            description={t('preferences.budgetAlert.desc')}
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
          <CardTitle>{t('preferences.projectDir.title')}</CardTitle>
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
              <Badge variant="muted">{t('preferences.projectDir.notSet')}</Badge>
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void browseProjectDir()}
          >
            <Icon name="folder-open" />
            {t('common:actions.browse')}
          </Button>
          {settings.defaultProjectDir && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void updatePrefs({ defaultProjectDir: undefined })}
            >
              {t('common:actions.clear')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
