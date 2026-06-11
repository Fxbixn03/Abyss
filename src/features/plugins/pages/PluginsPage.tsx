import { useEffect, useMemo, useState } from 'react'
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

const SOURCE_TYPES: { value: MarketplaceSourceType; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'git', label: 'Git URL' },
  { value: 'directory', label: 'Directory' },
  { value: 'file', label: 'File' },
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
        <PageHeader title="Plugins" icon="plug" />
        <EmptyState
          icon="plug"
          title={`${agent.displayName} has no plugins`}
          description="Plugin & marketplace management is specific to Claude Code. Switch to Claude to configure it."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Plugins" icon="plug" />
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
        title="Plugins"
        description={`Marketplaces & enabled plugins for ${agent.displayName}`}
        icon="plug"
        actions={
          <Button onClick={() => void save(basePath)} disabled={!dirty || saving}>
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 overflow-y-auto pb-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="store" className="size-4" />
              Marketplaces
            </CardTitle>
            <CardDescription>
              Catalogs Claude Code trusts. Declared as{' '}
              <code className="font-code text-xs">extraKnownMarketplaces</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.marketplaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No marketplaces declared yet.
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
                      aria-label="Remove marketplace"
                    >
                      <Icon name="trash" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="mp-name">Name</Label>
                <Input
                  id="mp-name"
                  value={mpName}
                  onChange={(e) => setMpName(e.target.value)}
                  placeholder="company-tools"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-type">Source</Label>
                <Select
                  value={mpType}
                  onValueChange={(v) => setMpType(v as MarketplaceSourceType)}
                >
                  <SelectTrigger id="mp-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mp-value">
                  {SOURCE_TYPES.find((t) => t.value === mpType)?.label} location
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
                  <Label htmlFor="mp-ref">Branch / tag (optional)</Label>
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
                  Add marketplace
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="plug" className="size-4" />
              Plugins
            </CardTitle>
            <CardDescription>
              Plugins to enable by default. Declared as{' '}
              <code className="font-code text-xs">enabledPlugins</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No plugins declared yet.
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
                      {p.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(v) => togglePlugin(p.key, v)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlugin(p.key)}
                      aria-label="Remove plugin"
                    >
                      <Icon name="trash" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {config.marketplaces.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                Add a marketplace first — plugins are referenced as{' '}
                <code className="font-code text-xs">plugin@marketplace</code>.
              </p>
            ) : (
              <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_180px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-name">Plugin name</Label>
                  <Input
                    id="pl-name"
                    value={pluginName}
                    onChange={(e) => setPluginName(e.target.value)}
                    placeholder="code-formatter"
                    className="font-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-market">Marketplace</Label>
                  <Select value={pluginMarket} onValueChange={setPluginMarket}>
                    <SelectTrigger id="pl-market">
                      <SelectValue placeholder="Choose…" />
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
                    Add
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            <p>
              These declarations live in <code className="font-code">settings.json</code>{' '}
              for the current scope. Claude Code clones and caches the actual
              plugin content under <code className="font-code">~/.claude/plugins</code>{' '}
              when it next starts and you trust the source.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
