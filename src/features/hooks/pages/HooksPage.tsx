import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { HOOK_EVENTS } from '@/shared/types/hooks'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useHooksStore } from '../store/hooks.store'
import { HookForm } from '../components/HookForm'

export function HooksPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const supported = agent.capabilities.hooks

  const entries = useHooksStore((s) => s.entries)
  const loading = useHooksStore((s) => s.loading)
  const load = useHooksStore((s) => s.load)
  const upsert = useHooksStore((s) => s.upsert)
  const remove = useHooksStore((s) => s.remove)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HookEntry | undefined>()
  const [deleting, setDeleting] = useState<HookEntry | undefined>()

  useEffect(() => {
    if (supported && basePath) void load(basePath)
  }, [supported, basePath, load])

  const grouped = useMemo(() => {
    const map = new Map<HookEvent, HookEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.event) ?? []
      list.push(entry)
      map.set(entry.event, list)
    }
    return HOOK_EVENTS.filter((e) => map.has(e)).map(
      (event) => [event, map.get(event)!] as const,
    )
  }, [entries])

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
        description={`Lifecycle hooks for ${agent.displayName} (settings.json)`}
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
        <div className="flex flex-col gap-5 overflow-y-auto pr-1">
          {grouped.map(([event, list]) => (
            <section key={event} className="space-y-2">
              <h2 className="font-code text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {event}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    {entry.matcher && (
                      <Badge variant="secondary" className="shrink-0 font-code">
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
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <HookForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={(entry) => void upsert(entry)}
      />

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(o) => {
          if (!o) setDeleting(undefined)
        }}
        title="Delete hook?"
        description="This removes the hook from settings.json."
        onConfirm={() => {
          if (deleting) void remove(deleting.id)
          setDeleting(undefined)
        }}
      />
    </div>
  )
}
