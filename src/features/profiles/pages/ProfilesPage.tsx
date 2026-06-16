import { useEffect, useState } from 'react'
import type { ApplyChange } from '@/shared/types/bundle'
import type { ProfileMeta } from '@/shared/types/profiles'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { formatDateTime } from '@/shared/lib/datetime'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { ENVIRONMENT_TEMPLATES, DEFAULT_PROFILE_ICON } from '../templates'

interface ProfileDraft {
  name: string
  description: string
  icon: string
}

function NameDialog({
  open,
  title,
  initial,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  initial: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}) {
  // Seeded once per mount; the parent remounts (via `key`) when it opens, so the
  // field always reflects the current `initial` without a set-state effect.
  const [name, setName] = useState(initial)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog: focus input on open per WCAG 2.1
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Profile name"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onConfirm(name.trim())
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Create dialog with a name + optional description (for environment profiles). */
function ProfileDialog({
  draft,
  onOpenChange,
  onConfirm,
}: {
  draft: ProfileDraft | null
  onOpenChange: (open: boolean) => void
  onConfirm: (draft: ProfileDraft) => void
}) {
  const [name, setName] = useState(draft?.name ?? '')
  const [description, setDescription] = useState(draft?.description ?? '')
  const icon = draft?.icon ?? DEFAULT_PROFILE_ICON
  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name={icon} className="size-4" />
            Save current config as profile
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog: focus input on open per WCAG 2.1
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Profile name"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() =>
              onConfirm({ name: name.trim(), description: description.trim(), icon })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [changes, setChanges] = useState<Record<string, ApplyChange[]>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const [createDraft, setCreateDraft] = useState<ProfileDraft | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProfileMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProfileMeta | null>(null)
  const [applyTarget, setApplyTarget] = useState<ProfileMeta | null>(null)
  const dateFormat = useSettingsStore((s) => s.settings.dateTimeFormat)

  const refresh = async () => {
    setProfiles(await ipc.profileList())
    setLoaded(true)
  }

  useEffect(() => {
    let active = true
    void ipc.profileList().then((list) => {
      if (!active) return
      setProfiles(list)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const create = async (draft: ProfileDraft) => {
    setCreateDraft(null)
    await ipc.profileSave(draft.name, {
      description: draft.description || undefined,
      icon: draft.icon,
    })
    setNotice(`Saved current config as “${draft.name}”`)
    void refresh()
  }

  const blankDraft: ProfileDraft = {
    name: '',
    description: '',
    icon: DEFAULT_PROFILE_ICON,
  }

  const rename = async (name: string) => {
    if (!renameTarget) return
    const target = renameTarget
    setRenameTarget(null)
    await ipc.profileRename(target.id, name)
    void refresh()
  }

  const dryRun = async (p: ProfileMeta) => {
    const result = await ipc.profileApply(p.id, true)
    setChanges((c) => ({ ...c, [p.id]: result }))
  }

  const apply = async () => {
    if (!applyTarget) return
    const target = applyTarget
    setApplyTarget(null)
    const result = await ipc.profileApply(target.id, false)
    const n = result.filter((c) => c.changed).length
    setNotice(`Applied “${target.name}” — ${n} file(s) changed.`)
    setChanges((c) => ({ ...c, [target.id]: result }))
  }

  const remove = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    await ipc.profileDelete(target.id)
    void refresh()
  }

  /** Dismiss a profile's dry-run preview without applying it. */
  const closeDryRun = (id: string) => {
    setChanges((c) => {
      const next = { ...c }
      delete next[id]
      return next
    })
  }

  const query = filter.trim().toLowerCase()
  const visibleProfiles = query
    ? profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query),
      )
    : profiles

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Profiles"
        description="Named environments — capture your setup and switch between them"
        icon="layers"
        actions={
          <div className="flex items-center gap-2">
            {profiles.length > 0 && (
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFilter('')
                  }}
                  placeholder="Filter profiles…"
                  className="h-9 w-48 pl-8"
                />
              </div>
            )}
            <Button onClick={() => setCreateDraft(blankDraft)}>
              <Icon name="plus" />
              New profile
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Icon name="layers" />
                  From template
                  <Icon name="chevron-down" className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-[280px]">
                <DropdownMenuLabel>Environment templates</DropdownMenuLabel>
                {ENVIRONMENT_TEMPLATES.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() =>
                      setCreateDraft({
                        name: t.name,
                        description: t.description,
                        icon: t.icon,
                      })
                    }
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Icon name={t.icon} className="size-3.5" />
                      {t.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <p className="px-2 py-1 text-[11px] text-muted-foreground">
                  Templates capture your current config under a named
                  environment.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-accent px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="circle-check" className="size-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      {loaded && profiles.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No profiles yet"
          description="Capture your current agent config as a named environment, then apply it any time (e.g. on another machine or to switch setups)."
          action={
            <Button onClick={() => setCreateDraft(blankDraft)}>
              <Icon name="plus" />
              New profile
            </Button>
          }
        />
      ) : visibleProfiles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No profiles match your filter.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {visibleProfiles.map((p) => {
            const diff = changes[p.id]
            return (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon name={p.icon ?? 'layers'} className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(p.createdAt, dateFormat)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {p.agentIds.map((id) => (
                      <Badge key={id} variant="muted">
                        {id}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setApplyTarget(p)}>
                    <Icon name="check" />
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void dryRun(p)}
                  >
                    <Icon name="eye" />
                    Dry run
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRenameTarget(p)}
                  >
                    <Icon name="pencil" />
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Icon name="trash" />
                    Delete
                  </Button>
                </div>

                {diff && <DryRunPreview diff={diff} onClose={() => closeDryRun(p.id)} />}
              </Card>
            )
          })}
        </div>
      )}

      <ProfileDialog
        key={`create-${createDraft?.icon ?? 'none'}-${createDraft?.name ?? ''}`}
        draft={createDraft}
        onOpenChange={(open) => {
          if (!open) setCreateDraft(null)
        }}
        onConfirm={(draft) => void create(draft)}
      />

      <NameDialog
        key={`rename-${renameTarget?.id ?? 'none'}`}
        open={renameTarget !== null}
        title="Rename profile"
        initial={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        onConfirm={(name) => void rename(name)}
      />

      <ConfirmDialog
        open={applyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApplyTarget(null)
        }}
        title={`Apply “${applyTarget?.name ?? ''}”?`}
        description="This overwrites your current agent config with the profile's. A snapshot of each file is taken first (see History), so it can be undone."
        confirmLabel="Apply"
        destructive={false}
        onConfirm={() => void apply()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete “${deleteTarget?.name ?? ''}”?`}
        description="This removes the saved profile. Your live config is untouched."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </div>
  )
}

/**
 * Dry-run result, grouped by agent so it's clear which files of which agent
 * would change. Dismissable via the close button (the preview is non-committal).
 */
function DryRunPreview({
  diff,
  onClose,
}: {
  diff: ApplyChange[]
  onClose: () => void
}) {
  const changedCount = diff.filter((c) => c.changed).length
  const byAgent = new Map<string, ApplyChange[]>()
  for (const c of diff) {
    const list = byAgent.get(c.agentId) ?? []
    list.push(c)
    byAgent.set(c.agentId, list)
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Icon name="eye" className="size-3.5 text-muted-foreground" />
          Dry run — {changedCount} of {diff.length} target(s) differ
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close dry run preview"
        >
          <Icon name="x" className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {[...byAgent.entries()].map(([agentId, items]) => (
          <div key={agentId} className="flex flex-col gap-0.5">
            <p className="flex items-center gap-1.5 font-code text-[11px] uppercase tracking-wide text-muted-foreground">
              <Badge variant="muted">{agentId}</Badge>
              {items.filter((c) => c.changed).length} changed
            </p>
            {items.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 pl-1"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon
                    name={c.changed ? 'triangle-alert' : 'circle-check'}
                    className={cn(
                      'size-3 shrink-0',
                      c.changed ? 'text-warning' : 'text-success',
                    )}
                  />
                  <span className="truncate font-code text-muted-foreground">
                    {c.kind}: {c.target}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0',
                    c.changed ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  {c.changed ? 'changes' : 'same'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
