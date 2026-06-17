import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PermissionColumn, PermissionRules } from '@/shared/types/config'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  isDiskWriteError,
  isWritePermissionError,
  reportDiskWriteError,
  reportError,
  reportWritePermissionError,
} from '@/shared/lib/errors'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useProjectDir,
  useScope,
} from '@/features/scope/hooks/useScopedBase'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { CodexApprovals } from '../components/CodexApprovals'
import {
  PermissionRuleEditor,
  type RuleSort,
} from '../components/PermissionRuleEditor'
import { PermissionPresets } from '../components/PermissionPresets'
import { PermissionTester } from '../components/PermissionTester'
import { PermissionShare } from '../components/PermissionShare'
import { PermissionMode } from '../components/PermissionMode'
import { AdditionalDirectories } from '../components/AdditionalDirectories'
import { buildConflictMap, findConflicts } from '../lib/conflicts'
import { mergeEffective } from '../lib/effective'
import { SECURITY_PRESETS } from '../lib/presets'

const SORT_OPTIONS: RuleSort[] = ['order', 'az', 'tool']

const EMPTY: PermissionRules = {
  allow: [],
  deny: [],
  ask: [],
  defaultMode: 'default',
  additionalDirectories: [],
}

export function PermissionsPage() {
  const { t } = useTranslation('permissions')
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const globalBase = useBasePath(agent.id)
  const { scope } = useScope()
  const projectDir = useProjectDir()
  const navigate = useNavigate()
  const supported = agent.capabilities.permissions
  const sortLabels: Record<RuleSort, string> = {
    order: t('sort.order'),
    az: t('sort.az'),
    tool: t('sort.tool'),
  }

  const [rules, setRules] = useState<PermissionRules>(EMPTY)
  // Rules from the global profile, surfaced read-only when editing a project.
  const [inherited, setInherited] = useState<PermissionRules>(EMPTY)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [sort, setSort] = useState<RuleSort>('order')
  const [view, setView] = useState<'own' | 'effective'>('own')
  const [mcpServers, setMcpServers] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    ipc
      .getPermissions(agent.id, basePath)
      .then((r) => {
        if (active) setRules(r)
      })
      .catch((err) => {
        if (active) reportError(err, { title: "Couldn't load permissions" })
      })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath])

  useEffect(() => {
    if (!supported || scope !== 'project' || !globalBase) return
    let active = true
    ipc
      .getPermissions(agent.id, globalBase)
      .then((r) => {
        if (active) setInherited(r)
      })
      .catch((err) => {
        if (active)
          reportError(err, { title: "Couldn't load inherited permissions" })
      })
    return () => {
      active = false
    }
  }, [supported, scope, agent.id, globalBase])

  // Load configured MCP servers so the builder can offer their tools.
  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.getMcpServers(agent.id, basePath, projectDir).then((servers) => {
      if (active) setMcpServers(servers.map((s) => s.name))
    })
    return () => {
      active = false
    }
  }, [supported, agent.id, basePath, projectDir])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }
  }, [])

  // Inherited rules only apply when overriding the global profile in a project.
  const shownInherited = scope === 'project' ? inherited : EMPTY
  const hasInherited =
    scope === 'project' &&
    (inherited.allow.length > 0 ||
      inherited.ask.length > 0 ||
      inherited.deny.length > 0)

  const conflicts = useMemo(() => buildConflictMap(rules), [rules])
  const conflictCount = useMemo(() => findConflicts(rules).length, [rules])
  const effective = useMemo(
    () => mergeEffective(inherited, rules),
    [inherited, rules],
  )

  // Effective view is only meaningful when there are inherited rules to merge.
  const showEffective = view === 'effective' && hasInherited
  const viewRules = showEffective ? effective : rules

  // Per-column counts that reflect the active filter (mirrors the logic in PermissionRuleEditor).
  const filteredCounts = useMemo<Record<PermissionColumn, number>>(() => {
    const q = deferredQuery.trim().toLowerCase()
    const match = (r: string) => !q || r.toLowerCase().includes(q)
    const source = showEffective ? effective : rules
    return {
      allow: source.allow.filter(match).length,
      deny: source.deny.filter(match).length,
      ask: source.ask.filter(match).length,
    }
  }, [deferredQuery, showEffective, effective, rules])
  const allEmpty =
    rules.allow.length === 0 &&
    rules.ask.length === 0 &&
    rules.deny.length === 0 &&
    !hasInherited

  const persist = async (next: PermissionRules) => {
    const previous = rules
    setRules(next)
    if (!basePath) return
    try {
      await ipc.setPermissions(agent.id, basePath, next)
    } catch (err) {
      setRules(previous) // roll back the optimistic update
      if (isWritePermissionError(err)) {
        reportWritePermissionError(err, (path) => void ipc.revealPath(path))
      } else if (isDiskWriteError(err)) {
        reportDiskWriteError(err)
      } else {
        reportError(err, { title: "Couldn't save permissions" })
      }
    }
  }

  const move = (from: PermissionColumn, rule: string, to: PermissionColumn) => {
    if (from === to) return
    void persist({
      ...rules,
      [from]: rules[from].filter((r) => r !== rule),
      [to]: rules[to].includes(rule) ? rules[to] : [...rules[to], rule],
    })
  }

  // Codex uses a different model (approval policy + sandbox), not allow/deny/ask.
  if (agent.id === 'codex') return <CodexApprovals />

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="shield" />
        <EmptyState
          icon="shield"
          title={t('noSupportTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="shield" />
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

  const sections: {
    key: PermissionColumn
    title: string
    description: string
    placeholder: string
    icon: string
    /** Top-border accent communicating the risk level of the column. */
    accent: string
    iconClass: string
    countVariant: 'success' | 'warning' | 'danger'
  }[] = [
    {
      key: 'allow',
      title: t('columns.allow.title'),
      description: t('columns.allow.desc'),
      placeholder: 'Bash(npm run test:*)',
      icon: 'circle-check',
      accent: 'border-t-2 border-t-success/60',
      iconClass: 'text-success',
      countVariant: 'success',
    },
    {
      key: 'ask',
      title: t('columns.ask.title'),
      description: t('columns.ask.desc'),
      placeholder: 'Bash(git push:*)',
      icon: 'circle-help',
      accent: 'border-t-2 border-t-warning/60',
      iconClass: 'text-warning',
      countVariant: 'warning',
    },
    {
      key: 'deny',
      title: t('columns.deny.title'),
      description: t('columns.deny.desc'),
      placeholder: 'Read(./.env)',
      icon: 'shield-x',
      accent: 'border-t-2 border-t-destructive/70',
      iconClass: 'text-destructive',
      countVariant: 'danger',
    },
  ]

  const copyRulesEmpty =
    rules.allow.length === 0 &&
    rules.deny.length === 0 &&
    rules.ask.length === 0

  const handleCopyAsJson = () => {
    const payload = { allow: rules.allow, deny: rules.deny, ask: rules.ask }
    void navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => {
        setCopied(true)
        if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => {
          setCopied(false)
          copyTimerRef.current = null
        }, 1500)
      })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('headerDescription', { agent: agent.displayName })}
        icon="shield"
        actions={
          <>
            <PermissionPresets rules={rules} onChange={persist} />
            <Button
              variant="outline"
              size="sm"
              disabled={copyRulesEmpty}
              onClick={handleCopyAsJson}
            >
              <Icon name={copied ? 'check' : 'copy'} />
              {copied ? t('copied') : t('copyJson')}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {hasInherited && (
          <div className="flex items-center rounded-md border border-border p-0.5">
            {(['own', 'effective'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors',
                  view === v
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'own' ? t('view.own') : t('view.effective')}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('filter')}
            className="h-9 w-[180px] pl-8"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="arrow-up-down" />
              {t('sort.label', { label: sortLabels[sort] })}
              <Icon name="chevron-down" className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((value) => (
              <DropdownMenuItem key={value} onSelect={() => setSort(value)}>
                <Icon
                  name="check"
                  className={cn('size-3.5', sort !== value && 'opacity-0')}
                />
                {sortLabels[value]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <PermissionTester rules={showEffective ? effective : rules} />
        <PermissionShare rules={rules} onChange={persist} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings-file')}
        >
          <Icon name="braces" />
          {t('viewJson')}
        </Button>
      </div>

      {conflictCount > 0 && !showEffective && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Icon name="circle-alert" className="size-4 shrink-0" />
          <span>{t('conflict', { count: conflictCount })}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 overflow-y-auto">
        {allEmpty && (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3">
            <Icon name="sparkles" className="size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('empty.title')}</p>
              <p className="text-xs text-muted-foreground">{t('empty.desc')}</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const standard = SECURITY_PRESETS.find(
                  (p) => p.id === 'standard',
                )
                if (standard)
                  void persist({
                    ...standard.rules,
                    defaultMode: rules.defaultMode,
                    additionalDirectories: rules.additionalDirectories,
                  })
              }}
            >
              <Icon name="shield-check" />
              {t('applyPreset')}
            </Button>
          </div>
        )}

        {!showEffective && (
          <div className="grid gap-4 md:grid-cols-2">
            <PermissionMode
              mode={rules.defaultMode}
              onChange={(defaultMode) => persist({ ...rules, defaultMode })}
            />
            <AdditionalDirectories
              dirs={rules.additionalDirectories ?? []}
              onChange={(additionalDirectories) =>
                persist({ ...rules, additionalDirectories })
              }
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => {
            const globalCount = shownInherited[section.key].length
            const visibleCount = filteredCounts[section.key]
            return (
              <Card key={section.key} className={section.accent}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon
                      name={section.icon}
                      className={`size-4 ${section.iconClass}`}
                    />
                    {section.title}
                    <span className="ml-auto flex items-center gap-1">
                      <Badge variant={section.countVariant}>
                        {visibleCount}
                      </Badge>
                      {!showEffective && globalCount > 0 && (
                        <Badge variant="muted">
                          {t('globalCount', { count: globalCount })}
                        </Badge>
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {showEffective ? t('effectiveDesc') : section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PermissionRuleEditor
                    category={section.key}
                    values={viewRules[section.key]}
                    inherited={showEffective ? [] : shownInherited[section.key]}
                    filter={deferredQuery}
                    sort={sort}
                    conflicts={showEffective ? undefined : conflicts}
                    mcpServers={mcpServers}
                    relativeBase={projectDir}
                    readOnly={showEffective}
                    onChange={(values) =>
                      persist({ ...rules, [section.key]: values })
                    }
                    onMove={(rule, target) => move(section.key, rule, target)}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
