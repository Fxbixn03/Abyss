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
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'

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

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [changes, setChanges] = useState<Record<string, ApplyChange[]>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ProfileMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProfileMeta | null>(null)
  const [applyTarget, setApplyTarget] = useState<ProfileMeta | null>(null)

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

  const create = async (name: string) => {
    setCreateOpen(false)
    await ipc.profileSave(name)
    setNotice(`Saved current config as “${name}”`)
    void refresh()
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

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Profiles"
        description="Named config sets — capture your setup and switch between them"
        icon="layers"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" />
            New profile
          </Button>
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
          description="Capture your current agent config as a named profile, then apply it any time (e.g. on another machine or to switch setups)."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Icon name="plus" />
              New profile
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {profiles.map((p) => {
            const diff = changes[p.id]
            return (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
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

                {diff && (
                  <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                    <p className="mb-1 font-medium">
                      {diff.filter((c) => c.changed).length} of {diff.length}{' '}
                      target(s) differ
                    </p>
                    {diff.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-code text-muted-foreground">
                          {c.kind}: {c.target}
                        </span>
                        <span
                          className={cn(
                            'shrink-0',
                            c.changed
                              ? 'text-warning'
                              : 'text-muted-foreground',
                          )}
                        >
                          {c.changed ? 'changes' : 'same'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <NameDialog
        key={`create-${createOpen}`}
        open={createOpen}
        title="Save current config as profile"
        initial=""
        confirmLabel="Save"
        onOpenChange={setCreateOpen}
        onConfirm={(name) => void create(name)}
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
