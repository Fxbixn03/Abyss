import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useHooksStore } from '../store/hooks.store'
import { HookForm } from '../components/HookForm'
import {
  checkHook,
  extractScriptPath,
  matcherMatches,
  resolveScriptPath,
  topSeverity,
} from '../lib/hookChecks'
import { buildSandboxSnippet } from '../lib/hookSandbox'

const SEVERITY_ICON = {
  error: { icon: 'circle-alert', className: 'text-destructive' },
  warning: { icon: 'alert-triangle', className: 'text-warning' },
  info: { icon: 'info', className: 'text-muted-foreground' },
} as const

export function HooksPage() {
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
  const load = useHooksStore((s) => s.load)
  const upsert = useHooksStore((s) => s.upsert)
  const remove = useHooksStore((s) => s.remove)
  const move = useHooksStore((s) => s.move)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HookEntry | undefined>()
  const [deleting, setDeleting] = useState<HookEntry | undefined>()
  const [scriptExists, setScriptExists] = useState<Record<string, boolean>>({})

  const events = useMemo(() => hookEventsFor(agent.id), [agent.id])
  const hooksFile =
    agent.id === 'gemini'
      ? 'hooks/hooks.json'
      : agent.id === 'cursor'
        ? 'hooks.json'
        : 'settings.json'

  // Other enabled agents that can receive a copied hook.
  const copyTargets = useMemo(
    () => allAgents.filter((a) => a.id !== agent.id && a.capabilities.hooks),
    [allAgents, agent.id],
  )

  useEffect(() => {
    if (supported && basePath) void load(agent.id, basePath)
  }, [supported, agent.id, basePath, load])

  // Per-hook resolved script path (if the command points at one).
  const scriptByHook = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of entries) {
      const token = extractScriptPath(entry.command)
      if (!token) continue
      const resolved = resolveScriptPath(token, basePath, agent.id)
      if (resolved) map.set(entry.id, resolved)
    }
    return map
  }, [entries, basePath, agent.id])

  // Check whether each referenced script actually exists on disk.
  useEffect(() => {
    let cancelled = false
    const paths = [...new Set(scriptByHook.values())]
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
    () => new Set(entries.map((e) => e.event)),
    [entries],
  )

  const testInSandbox = (entry: HookEntry) => {
    requestCommand(buildSandboxSnippet(entry))
    navigate('/sandbox')
  }

  const copyToAgent = async (entry: HookEntry, target: AgentAdapter) => {
    const base =
      scope === 'global'
        ? getBasePath(target.id)
        : projectDir
          ? joinPath(projectDir, `.${target.id}`)
          : ''
    if (!base) {
      toast.error(`No config location for ${target.displayName}`)
      return
    }
    try {
      const existing = await ipc.getHooks(target.id, base)
      const copy: HookEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timeout: supportsHookTimeout(target.id) ? entry.timeout : undefined,
      }
      await ipc.setHooks(target.id, base, [...existing, copy])
      toast.success(`Copied hook to ${target.displayName}`)
    } catch (err) {
      reportError(err, { title: "Couldn't copy hook" })
    }
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Hooks" icon="webhook" />
        <EmptyState
          icon="webhook"
          title={`${agent.displayName} has no hooks`}
          description="Switch to an agent that supports lifecycle hooks."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Hooks" icon="webhook" />
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings to manage hooks."
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
        title="Hooks"
        description={`Lifecycle hooks for ${agent.displayName} (${hooksFile})`}
        icon="webhook"
        actions={
          <Button
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            <Icon name="plus" />
            Add hook
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="webhook"
          title="No hooks configured"
          description="Run a command on events like PreToolUse, PostToolUse or Stop."
          action={
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Icon name="plus" />
              Add hook
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <CoverageOverview events={events} covered={coveredEvents} />
          <MatcherDryRun entries={entries} />

          {grouped.map(([event, list]) => (
            <section key={event} className="space-y-2">
              <h2 className="font-code text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {event}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((entry) => {
                  const issues = checkHook(entry)
                  const sev = topSeverity(issues)
                  const sameMatcher = list
                    .map((e, idx) => ({ e, idx }))
                    .filter(({ e }) => e.matcher === entry.matcher)
                  const posInGroup = sameMatcher.findIndex(
                    ({ e }) => e.id === entry.id,
                  )
                  const script = scriptByHook.get(entry.id)
                  const missing = script
                    ? scriptExists[script] === false
                    : false
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      {sameMatcher.length > 1 && (
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-4"
                            disabled={posInGroup === 0}
                            onClick={() => void move(entry.id, 'up')}
                            aria-label="Move up"
                          >
                            <Icon name="chevron-up" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-4"
                            disabled={posInGroup === sameMatcher.length - 1}
                            onClick={() => void move(entry.id, 'down')}
                            aria-label="Move down"
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
                            Script file not found on disk.
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => testInSandbox(entry)}
                        aria-label="Test in Sandbox"
                        title="Test in Sandbox"
                      >
                        <Icon name="flask-conical" />
                      </Button>

                      {script && scriptExists[script] && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void ipc.revealPath(script)}
                          aria-label="Open script"
                          title="Reveal script file"
                        >
                          <Icon name="external-link" />
                        </Button>
                      )}

                      {copyTargets.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Copy hook to another agent"
                              title="Copy to another agent"
                            >
                              <Icon name="copy" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Copy to</DropdownMenuLabel>
                            {copyTargets.map((t) => (
                              <DropdownMenuItem
                                key={t.id}
                                onClick={() => void copyToAgent(entry, t)}
                              >
                                <Icon name={t.icon} />
                                {t.displayName}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(entry)
                          setFormOpen(true)
                        }}
                        aria-label="Edit hook"
                      >
                        <Icon name="pencil" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(entry)}
                        aria-label="Delete hook"
                      >
                        <Icon name="trash" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
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

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(o) => {
          if (!o) setDeleting(undefined)
        }}
        title="Delete hook?"
        description={`This removes the hook from ${hooksFile}.`}
        onConfirm={() => {
          if (deleting) void remove(deleting.id)
          setDeleting(undefined)
        }}
      />
    </div>
  )
}

/** Which lifecycle events currently have at least one hook, and which don't. */
function CoverageOverview({
  events,
  covered,
}: {
  events: readonly HookEvent[]
  covered: Set<HookEvent>
}) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name="layout-dashboard" className="size-3.5" />
        Event coverage
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
  const [tool, setTool] = useState('')
  const toolEntries = useMemo(
    () =>
      entries.filter(
        (e) => e.event === 'PreToolUse' || e.event === 'PostToolUse',
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
        Matcher dry-run
      </div>
      <Input
        value={tool}
        onChange={(e) => setTool(e.target.value)}
        placeholder="Tool name, e.g. Bash or Edit"
        className="font-code text-xs"
      />
      {tool.trim() !== '' && (
        <p className="text-xs text-muted-foreground">
          {matches.length === 0 ? (
            <>
              No hook matches <span className="font-code">{tool}</span>.
            </>
          ) : (
            <>
              {matches.length} hook{matches.length === 1 ? '' : 's'} match{' '}
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
