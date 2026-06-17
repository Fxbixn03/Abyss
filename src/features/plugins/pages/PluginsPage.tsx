import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import type {
  MarketplaceSource,
  MarketplaceSourceType,
} from '@/shared/types/plugins'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { usePluginsStore } from '../store/plugins.store'

const SOURCE_TYPES: MarketplaceSourceType[] = [
  'github',
  'git',
  'directory',
  'file',
]

const SOURCE_PLACEHOLDER: Record<MarketplaceSourceType, string> = {
  github: 'owner/repo',
  git: 'https://git.example.com/team/plugins.git',
  directory: '/path/to/marketplace',
  file: '/path/to/marketplace.json',
}

function sourceSummary(src: MarketplaceSource): string {
  const ref = src.ref ? `@${src.ref}` : ''
  switch (src.source) {
    case 'github':
      return `github:${src.repo ?? '?'}${ref}`
    case 'git':
      return `git:${src.url ?? '?'}${ref}`
    case 'directory':
      return `dir:${src.path ?? '?'}`
    case 'file':
      return `file:${src.path ?? '?'}`
  }
}

export function PluginsPage() {
  const { t } = useTranslation(['plugins', 'common'])
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.plugins === true

  const config = usePluginsStore((s) => s.config)
  const saved = usePluginsStore((s) => s.saved)
  const saving = usePluginsStore((s) => s.saving)
  const load = usePluginsStore((s) => s.load)
  const update = usePluginsStore((s) => s.update)
  const save = usePluginsStore((s) => s.save)

  // New-marketplace form.
  const [mpName, setMpName] = useState('')
  const [mpType, setMpType] = useState<MarketplaceSourceType>('github')
  const [mpValue, setMpValue] = useState('')
  const [mpRef, setMpRef] = useState('')

  // New-plugin form.
  const [pluginName, setPluginName] = useState('')
  const [pluginMarket, setPluginMarket] = useState('')

  useEffect(() => {
    if (supported && basePath) void load(basePath)
  }, [supported, basePath, load])

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(saved),
    [config, saved],
  )

  const addMarketplace = () => {
    const name = mpName.trim()
    const value = mpValue.trim()
    if (!name || !value) return
    const source: MarketplaceSource = { source: mpType }
    if (mpType === 'github') source.repo = value
    else if (mpType === 'git') source.url = value
    else source.path = value
    if (mpRef.trim()) source.ref = mpRef.trim()
    update({
      ...config,
      marketplaces: [
        ...config.marketplaces.filter((m) => m.name !== name),
        { name, source },
      ],
    })
    setMpName('')
    setMpValue('')
    setMpRef('')
  }

  const removeMarketplace = (name: string) =>
    update({
      ...config,
      marketplaces: config.marketplaces.filter((m) => m.name !== name),
    })

  const addPlugin = () => {
    const plugin = pluginName.trim()
    const market = pluginMarket.trim()
    if (!plugin || !market) return
    const key = `${plugin}@${market}`
    update({
      ...config,
      plugins: [
        ...config.plugins.filter((p) => p.key !== key),
        { key, enabled: true },
      ],
    })
    setPluginName('')
  }

  const togglePlugin = (key: string, enabled: boolean) =>
    update({
      ...config,
      plugins: config.plugins.map((p) => (p.key === key ? { ...p, enabled } : p)),
    })

  const removePlugin = (key: string) =>
    update({ ...config, plugins: config.plugins.filter((p) => p.key !== key) })

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="plug" />
        <EmptyState
          icon="plug"
          title={t('noSupportTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="plug" />
        <EmptyState
          icon="folder"
          title={t('noPath.title')}
          description={t('noPath.desc')}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              {t('openSettings')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('headerDescription', { agent: agent.displayName })}
        icon="plug"
        actions={
          <Button onClick={() => void save(basePath)} disabled={!dirty || saving}>
            <Icon name="save" />
            {saving ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 overflow-y-auto pb-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="store" className="size-4" />
              {t('marketplaces.heading')}
            </CardTitle>
            <CardDescription>{t('marketplaces.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.marketplaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('marketplaces.empty')}
              </p>
            ) : (
              <ul className="space-y-2">
                {config.marketplaces.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{m.name}</div>
                      <code className="block truncate font-code text-xs text-muted-foreground">
                        {sourceSummary(m.source)}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMarketplace(m.name)}
                      aria-label={t('marketplaces.remove')}
                    >
                      <Icon name="trash" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="mp-name">{t('marketplaces.name')}</Label>
                <Input
                  id="mp-name"
                  value={mpName}
                  onChange={(e) => setMpName(e.target.value)}
                  placeholder={t('marketplaces.namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-type">{t('marketplaces.source')}</Label>
                <Select
                  value={mpType}
                  onValueChange={(v) => setMpType(v as MarketplaceSourceType)}
                >
                  <SelectTrigger id="mp-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`sourceTypes.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mp-value">
                  {t('marketplaces.locationLabel', {
                    type: t(`sourceTypes.${mpType}`),
                  })}
                </Label>
                <Input
                  id="mp-value"
                  value={mpValue}
                  onChange={(e) => setMpValue(e.target.value)}
                  placeholder={SOURCE_PLACEHOLDER[mpType]}
                  className="font-code"
                />
              </div>
              {(mpType === 'github' || mpType === 'git') && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="mp-ref">{t('marketplaces.branchTag')}</Label>
                  <Input
                    id="mp-ref"
                    value={mpRef}
                    onChange={(e) => setMpRef(e.target.value)}
                    placeholder="main"
                    className="font-code"
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <Button
                  variant="outline"
                  onClick={addMarketplace}
                  disabled={!mpName.trim() || !mpValue.trim()}
                >
                  <Icon name="plus" />
                  {t('marketplaces.add')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="plug" className="size-4" />
              {t('plugins.heading')}
            </CardTitle>
            <CardDescription>{t('plugins.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('plugins.empty')}
              </p>
            ) : (
              <ul className="space-y-2">
                {config.plugins.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <code className="min-w-0 flex-1 truncate font-code text-sm">
                      {p.key}
                    </code>
                    <Badge variant={p.enabled ? 'default' : 'outline'}>
                      {p.enabled ? t('plugins.enabled') : t('plugins.disabled')}
                    </Badge>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(v) => togglePlugin(p.key, v)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlugin(p.key)}
                      aria-label={t('plugins.remove')}
                    >
                      <Icon name="trash" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {config.marketplaces.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                {t('plugins.addFirst')}
              </p>
            ) : (
              <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_180px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-name">{t('plugins.name')}</Label>
                  <Input
                    id="pl-name"
                    value={pluginName}
                    onChange={(e) => setPluginName(e.target.value)}
                    placeholder={t('plugins.namePlaceholder')}
                    className="font-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-market">{t('plugins.marketplace')}</Label>
                  <Select value={pluginMarket} onValueChange={setPluginMarket}>
                    <SelectTrigger id="pl-market">
                      <SelectValue placeholder={t('plugins.choose')} />
                    </SelectTrigger>
                    <SelectContent>
                      {config.marketplaces.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={addPlugin}
                    disabled={!pluginName.trim() || !pluginMarket.trim()}
                  >
                    <Icon name="plus" />
                    {t('plugins.add')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            <p>{t('note')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
