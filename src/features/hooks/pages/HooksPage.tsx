import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AgentAdapter } from '@/shared/types/agent'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { hookEventsFor, supportsHookTimeout } from '@/shared/types/hooks'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ConfigCorruptBanner } from '@/shared/components/ConfigCorruptBanner'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import {
  useConfigBase,
  useScope,
  joinPath,
} from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useSandboxIntent } from '@/features/sandbox/store/sandboxIntent.store'
import { FileHistoryDialog } from '@/features/config/components/FileHistoryDialog'
import { useHooksStore } from '../store/hooks.store'
import { HookForm } from '../components/HookForm'
import { ScriptEditorDialog } from '../components/ScriptEditorDialog'
import { CrossAgentHooksDialog } from '../components/CrossAgentHooksDialog'
import {
  checkHook,
  extractScriptPath,
  matcherMatches,
  resolveScriptPath,
  topSeverity,
} from '../lib/hookChecks'
import { buildSandboxSnippet } from '../lib/hookSandbox'
import { buildHooksBundle, parseHooksBundle } from '../lib/hooksBundle'

const SEVERITY_ICON = {
  error: { icon: 'circle-alert', className: 'text-destructive' },
  warning: { icon: 'alert-triangle', className: 'text-warning' },
  info: { icon: 'info', className: 'text-muted-foreground' },
} as const

interface ScriptRef {
  token: string
  path: string
}

export function HooksPage() {
  const { t } = useTranslation('hooks')
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.hooks

  const allAgents = useAllAgents()
  const { scope, projectDir } = useScope()
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  const requestCommand = useSandboxIntent((s) => s.requestCommand)

  const entries = useHooksStore((s) => s.entries)
  const loading = useHooksStore((s) => s.loading)
  const parseError = useHooksStore((s) => s.parseError)
  const load = useHooksStore((s) => s.load)
  const upsert = useHooksStore((s) => s.upsert)
  const remove = useHooksStore((s) => s.remove)
  const toggle = useHooksStore((s) => s.toggle)
  const move = useHooksStore((s) => s.move)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HookEntry | undefined>()
  const [deleting, setDeleting] = useState<HookEntry | undefined>()
  const [scriptExists, setScriptExists] = useState<Record<string, boolean>>({})
  const [scriptEdit, setScriptEdit] = useState<ScriptRef | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyCurrent, setHistoryCurrent] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [otherHooks, setOtherHooks] = useState<HookEntry[]>([])
  const [selectedEvents, setSelectedEvents] = useState<Set<HookEvent>>(
    new Set(),
  )

  const events = useMemo(() => hookEventsFor(agent.id), [agent.id])
  const hooksFile =
    agent.id === 'gemini'
      ? 'hooks/hooks.json'
      : agent.id === 'cursor'
        ? 'hooks.json'
        : 'settings.json'
  const hooksFilePath = useMemo(
    () => (basePath ? joinPath(basePath, hooksFile) : ''),
    [basePath, hooksFile],
  )

  // Resolve any agent's config base for the current scope.
  const configBaseFor = useCallback(
    (agentId: string): string =>
      scope === 'global'
        ? getBasePath(agentId)
        : projectDir
          ? joinPath(projectDir, `.${agentId}`)
          : '',
    [scope, projectDir, getBasePath],
  )

  // Other enabled agents that can receive a copied hook / appear in the overview.
  const hookAgents = useMemo(
    () => allAgents.filter((a) => a.capabilities.hooks),
    [allAgents],
  )
  const copyTargets = useMemo(
    () => hookAgents.filter((a) => a.id !== agent.id),
    [hookAgents, agent.id],
  )

  const otherScope = scope === 'global' ? 'project' : 'global'
  const canShowOther = scope === 'global' ? Boolean(projectDir) : true

  useEffect(() => {
    if (supported && basePath) void load(agent.id, basePath)
  }, [supported, agent.id, basePath, load])

  // Per-hook resolved script reference (if the command points at one).
  const scriptByHook = useMemo(() => {
    const map = new Map<string, ScriptRef>()
    for (const entry of entries) {
      const token = extractScriptPath(entry.command)
      if (!token) continue
      const path = resolveScriptPath(token, basePath, agent.id)
      if (path) map.set(entry.id, { token, path })
    }
    return map
  }, [entries, basePath, agent.id])

  // Check whether each referenced script actually exists on disk.
  useEffect(() => {
    let cancelled = false
    const paths = [...new Set([...scriptByHook.values()].map((s) => s.path))]
    void Promise.all(
      paths.map(async (p) => [p, (await ipc.fileExists(p)).exists] as const),
    ).then((pairs) => {
      if (cancelled) return
      setScriptExists(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [scriptByHook])

  // Read the other scope's hooks when the merged view is on.
  useEffect(() => {
    if (!showOther) return
    let cancelled = false
    const otherBase =
      otherScope === 'global'
        ? getBasePath(agent.id)
        : projectDir
          ? joinPath(projectDir, `.${agent.id}`)
          : ''
    void Promise.resolve()
      .then(() => (otherBase ? ipc.getHooks(agent.id, otherBase) : []))
      .then((list) => {
        if (!cancelled) setOtherHooks(list)
      })
      .catch(() => {
        if (!cancelled) setOtherHooks([])
      })
    return () => {
      cancelled = true
    }
  }, [showOther, otherScope, agent.id, projectDir, getBasePath, entries])

  const grouped = useMemo(() => {
    const map = new Map<HookEvent, HookEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.event) ?? []
      list.push(entry)
      map.set(entry.event, list)
    }
    return events
      .filter((e) => map.has(e))
      .map((event) => [event, map.get(event)!] as const)
  }, [entries, events])

  const coveredEvents = useMemo(
    () => new Set(entries.filter((e) => !e.disabled).map((e) => e.event)),
    [entries],
  )

  // Unique event types present in entries, ordered as they appear in `events`.
  const distinctEvents = useMemo(() => {
    const present = new Set(entries.map((e) => e.event))
    return events.filter((e) => present.has(e))
  }, [entries, events])

  const filteredGrouped = useMemo(
    () =>
      selectedEvents.size === 0
        ? grouped
        : grouped.filter(([event]) => selectedEvents.has(event)),
    [grouped, selectedEvents],
  )

  const toggleEvent = (event: HookEvent) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) {
        next.delete(event)
      } else {
        next.add(event)
      }
      return next
    })
  }

  const testInSandbox = (entry: HookEntry) => {
    requestCommand(buildSandboxSnippet(entry))
    void navigate('/sandbox')
  }

  // Clone a hook into the form (new id, enabled) so the user can tweak the copy
  // before saving it through the normal upsert path. Replaces any open form.
  const duplicate = (entry: HookEntry) => {
    setFormOpen(false)
    setEditing({
      ...entry,
      id: crypto.randomUUID(),
      disabled: undefined,
    })
    setFormOpen(true)
  }

  const copyToAgent = async (entry: HookEntry, target: AgentAdapter) => {
    const base = configBaseFor(target.id)
    if (!base) {
      toast.error(t('toasts.noConfigFor', { agent: target.displayName }))
      return
    }
    try {
      const existing = await ipc.getHooks(target.id, base)
      const copy: HookEntry = {
        ...entry,
        id: crypto.randomUUID(),
        disabled: undefined,
        timeout: supportsHookTimeout(target.id) ? entry.timeout : undefined,
      }
      await ipc.setHooks(target.id, base, [...existing, copy])
      toast.success(t('toasts.copiedTo', { agent: target.displayName }))
    } catch (err) {
      reportError(err, { title: t('toasts.copyFailed') })
    }
  }

  const openHistory = async () => {
    if (!hooksFilePath) return
    const r = await ipc.readTextFile(hooksFilePath).catch(() => null)
    setHistoryCurrent(r?.content ?? '')
    setHistoryOpen(true)
  }

  const exportHooks = async () => {
    const bundle = buildHooksBundle(agent.id, entries)
    const res = await ipc
      .saveTextFile(JSON.stringify(bundle, null, 2), {
        defaultName: `${agent.id}-hooks.json`,
        title: t('dialogTitles.export'),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      .catch(() => null)
    if (res?.path) toast.success(t('toasts.exported'))
  }

  const importHooks = async () => {
    const picked = await ipc
      .pickFile({
        title: t('dialogTitles.import'),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      .catch(() => null)
    if (!picked?.path) return
    const r = await ipc.readTextFile(picked.path).catch(() => null)
    if (!r?.exists) return
    let imported: HookEntry[]
    try {
      imported = parseHooksBundle(r.content)
    } catch (err) {
      toast.error(
        t('toasts.importFailed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      )
      return
    }
    for (const entry of imported) await upsert(entry)
    toast.success(t('toasts.imported', { count: imported.length }))
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="webhook" />
        <EmptyState
          icon="webhook"
          title={t('noHooksTitle', { agent: agent.displayName })}
          description={t('unsupportedDesc')}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={t('title')} icon="webhook" />
        <EmptyState
          icon="folder"
          title={t('noPath.title')}
          description={t('noPath.desc')}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              {t('actions.openSettings')}
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
        description={t('headerDescription', {
          agent: agent.displayName,
          file: hooksFile,
        })}
        icon="webhook"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Icon name="sliders" />
                  {t('actions.more')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setOverviewOpen(true)}>
                  <Icon name="layout-dashboard" />
                  {t('labels.whatRuns')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void openHistory()}>
                  <Icon name="history" />
                  {t('labels.fileHistory')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void importHooks()}>
                  <Icon name="upload" />
                  {t('actions.import')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void exportHooks()}
                  disabled={entries.length === 0}
                >
                  <Icon name="download" />
                  {t('actions.export')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Icon name="plus" />
              {t('actions.add')}
            </Button>
          </div>
        }
      />

      {parseError ? (
        <ConfigCorruptBanner
          info={parseError}
          onRetry={() => void load(agent.id, basePath)}
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t('actions.loading')}</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="webhook"
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Icon name="plus" />
              {t('actions.add')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <CoverageOverview events={events} covered={coveredEvents} />
          <MatcherDryRun entries={entries} />

          {distinctEvents.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {distinctEvents.map((event) => {
                const active = selectedEvents.has(event)
                return (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 font-code text-xs transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {event}
                  </button>
                )
              })}
            </div>
          )}

          {filteredGrouped.map(([event, list]) => (
            <section key={event} className="space-y-2">
              <h2 className="font-code text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {event}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((entry) => {
                  const issues = checkHook(entry)
                  const sev = topSeverity(issues)
                  const sameMatcher = list.filter(
                    (e) =>
                      e.matcher === entry.matcher &&
                      Boolean(e.disabled) === Boolean(entry.disabled),
                  )
                  const posInGroup = sameMatcher.findIndex(
                    (e) => e.id === entry.id,
                  )
                  const script = scriptByHook.get(entry.id)
                  const exists = script ? scriptExists[script.path] : undefined
                  const missing = script ? exists === false : false
                  return (
                    <li
                      key={entry.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border border-border bg-card p-3',
                        entry.disabled && 'opacity-55',
                      )}
                    >
                      {sameMatcher.length > 1 && (
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-4"
                            disabled={posInGroup === 0}
                            onClick={() => void move(entry.id, 'up')}
                            aria-label={t('aria.moveUp')}
                          >
                            <Icon name="chevron-up" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-4"
                            disabled={posInGroup === sameMatcher.length - 1}
                            onClick={() => void move(entry.id, 'down')}
                            aria-label={t('aria.moveDown')}
                          >
                            <Icon name="chevron-down" />
                          </Button>
                        </div>
                      )}

                      {entry.matcher && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-code"
                        >
                          {entry.matcher}
                        </Badge>
                      )}

                      <code
                        data-selectable
                        className="min-w-0 flex-1 truncate font-code text-xs text-muted-foreground"
                        title={entry.command}
                      >
                        {entry.command}
                      </code>

                      {entry.disabled && (
                        <Badge variant="muted" className="shrink-0">
                          {t('badges.disabled')}
                        </Badge>
                      )}

                      {entry.timeout !== undefined && (
                        <Badge variant="muted" className="shrink-0 font-code">
                          <Icon name="clock" />
                          {entry.timeout}s
                        </Badge>
                      )}

                      {sev && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0">
                              <Icon
                                name={SEVERITY_ICON[sev].icon}
                                className={cn(
                                  'size-4',
                                  SEVERITY_ICON[sev].className,
                                )}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <ul className="space-y-0.5">
                              {issues.map((issue, idx) => (
                                <li key={idx}>{issue.message}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {missing && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0">
                              <Icon
                                name="circle-alert"
                                className="size-4 text-destructive"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('labels.scriptNotFound')}
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('aria.actions')}
                          >
                            <Icon name="sliders" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => testInSandbox(entry)}
                          >
                            <Icon name="flask-conical" />
                            {t('actions.test')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void toggle(entry.id)}
                          >
                            <Icon name={entry.disabled ? 'play' : 'pause'} />
                            {entry.disabled
                              ? t('toggle.enable')
                              : t('toggle.disable')}
                          </DropdownMenuItem>
                          {script && (
                            <DropdownMenuItem
                              onClick={() => setScriptEdit(script)}
                            >
                              <Icon name={exists ? 'pencil' : 'file-plus'} />
                              {exists
                                ? t('script.edit')
                                : t('script.create')}
                            </DropdownMenuItem>
                          )}
                          {script && exists && (
                            <DropdownMenuItem
                              onClick={() => void ipc.revealPath(script.path)}
                            >
                              <Icon name="external-link" />
                              {t('actions.revealScript')}
                            </DropdownMenuItem>
                          )}
                          {copyTargets.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>
                                {t('actions.copyTo')}
                              </DropdownMenuLabel>
                              {copyTargets.map((target) => (
                                <DropdownMenuItem
                                  key={target.id}
                                  onClick={() =>
                                    void copyToAgent(entry, target)
                                  }
                                >
                                  <Icon name={target.icon} />
                                  {target.displayName}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(entry)
                          setFormOpen(true)
                        }}
                        aria-label={t('aria.edit')}
                      >
                        <Icon name="pencil" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => duplicate(entry)}
                        aria-label={t('aria.duplicate')}
                      >
                        <Icon name="copy" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(entry)}
                        aria-label={t('aria.delete')}
                      >
                        <Icon name="trash" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {canShowOther && (
            <OtherScopeView
              show={showOther}
              onToggle={() => setShowOther((v) => !v)}
              otherScope={otherScope}
              hooks={otherHooks}
            />
          )}
        </div>
      )}

      <HookForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        agentId={agent.id}
        events={events}
        onSubmit={(entry) => void upsert(entry)}
      />

      {scriptEdit && (
        <ScriptEditorDialog
          open={scriptEdit !== null}
          onOpenChange={(o) => {
            if (!o) setScriptEdit(null)
          }}
          scriptPath={scriptEdit.path}
          scriptToken={scriptEdit.token}
          onSaved={() => {
            if (basePath) void load(agent.id, basePath)
          }}
        />
      )}

      <CrossAgentHooksDialog
        open={overviewOpen}
        onOpenChange={setOverviewOpen}
        agents={hookAgents}
        baseFor={configBaseFor}
        scopeLabel={scope}
      />

      <FileHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        filePath={hooksFilePath}
        current={historyCurrent}
        onRestored={() => {
          if (basePath) void load(agent.id, basePath)
        }}
      />

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(o) => {
          if (!o) setDeleting(undefined)
        }}
        title={t('confirmDelete.title')}
        description={t('confirmDelete.desc', { file: hooksFile })}
        onConfirm={() => {
          if (deleting) void remove(deleting.id)
          setDeleting(undefined)
        }}
      />
    </div>
  )
}

/** Which lifecycle events currently have at least one active hook. */
function CoverageOverview({
  events,
  covered,
}: {
  events: readonly HookEvent[]
  covered: Set<HookEvent>
}) {
  const { t } = useTranslation('hooks')
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name="layout-dashboard" className="size-3.5" />
        {t('labels.eventCoverage')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {events.map((event) => {
          const on = covered.has(event)
          return (
            <span
              key={event}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 font-code text-xs',
                on
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-border text-muted-foreground',
              )}
            >
              <Icon name={on ? 'circle-check' : 'circle'} className="size-3" />
              {event}
            </span>
          )
        })}
      </div>
    </Card>
  )
}

/** Enter a tool name and see which Pre/PostToolUse hooks would match it. */
function MatcherDryRun({ entries }: { entries: HookEntry[] }) {
  const { t } = useTranslation('hooks')
  const [tool, setTool] = useState('')
  const toolEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          !e.disabled &&
          (e.event === 'PreToolUse' || e.event === 'PostToolUse'),
      ),
    [entries],
  )
  const matches = useMemo(() => {
    if (tool.trim() === '') return []
    return toolEntries.filter((e) => matcherMatches(e.matcher, tool.trim()))
  }, [toolEntries, tool])

  if (toolEntries.length === 0) return null

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name="scan-search" className="size-3.5" />
        {t('labels.matcherDryRun')}
      </div>
      <Input
        value={tool}
        onChange={(e) => setTool(e.target.value)}
        placeholder={t('matcherPlaceholder')}
        className="font-code text-xs"
      />
      {tool.trim() !== '' && (
        <p className="text-xs text-muted-foreground">
          {matches.length === 0 ? (
            <>
              {t('labels.noMatch')} <span className="font-code">{tool}</span>.
            </>
          ) : (
            <>
              {t('dryRun.match', { count: matches.length })}{' '}
              <span className="font-code">{tool}</span>:
            </>
          )}
        </p>
      )}
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Badge variant="muted" className="font-code">
                {e.event}
              </Badge>
              <span className="font-code">{e.matcher || '*'}</span>
              <code className="min-w-0 flex-1 truncate font-code">
                {e.command}
              </code>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Read-only view of the OTHER scope's hooks, so origin is visible. */
function OtherScopeView({
  show,
  onToggle,
  otherScope,
  hooks,
}: {
  show: boolean
  onToggle: () => void
  otherScope: 'global' | 'project'
  hooks: HookEntry[]
}) {
  const { t } = useTranslation('hooks')
  return (
    <Card className="space-y-2 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <Icon
          name={show ? 'chevron-down' : 'chevron-right'}
          className="size-3.5"
        />
        <Icon name="git-compare" className="size-3.5" />
        {show
          ? t('otherScope.hide', { scope: otherScope })
          : t('otherScope.show', { scope: otherScope })}
        {show && (
          <Badge variant="muted" className="ml-1 font-code">
            {hooks.length}
          </Badge>
        )}
      </button>
      {show &&
        (hooks.length === 0 ? (
          <p className="pl-6 text-xs text-muted-foreground">
            {t('otherScope.empty', { scope: otherScope })}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 pl-6">
            {hooks.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Badge variant="outline" className="font-code">
                  {otherScope}
                </Badge>
                <Badge variant="secondary" className="font-code">
                  {h.event}
                </Badge>
                {h.matcher && (
                  <span className="font-code text-foreground/70">
                    {h.matcher}
                  </span>
                )}
                <code className="min-w-0 flex-1 truncate font-code">
                  {h.command}
                </code>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  )
}
