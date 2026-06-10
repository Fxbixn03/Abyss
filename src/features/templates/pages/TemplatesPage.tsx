import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Markdown } from '@/shared/components/Markdown'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import type { TemplatePack } from '@/shared/types/template-pack'
import { useTemplatesStore } from '../store/templates.store'
import { useTemplatesIntent } from '../store/templatesIntent.store'
import { resolveTemplates } from '../lib/resolve'
import { hasVariables } from '../lib/variables'
import { composeTemplates } from '../lib/apply'
import { TemplateEditorDialog } from '../components/TemplateEditorDialog'
import {
  TemplateApplyDialog,
  type ApplySource,
} from '../components/TemplateApplyDialog'
import { VariablesDialog } from '../components/VariablesDialog'
import type { PromptTemplate } from '../types'

interface ApplyState {
  source: ApplySource
  ids: string[]
}

/** Read-only preview of a template's full content. */
function TemplatePreviewDialog({
  template,
  onOpenChange,
  onApply,
  onCopy,
}: {
  template: PromptTemplate | null
  onOpenChange: (v: boolean) => void
  onApply: (t: PromptTemplate) => void
  onCopy: (t: PromptTemplate) => void
}) {
  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template?.title}
            {template && !template.builtin && (
              <Badge variant="muted">custom</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {template && (
          <>
            {template.description && (
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>
            )}
            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="font-code text-[10px]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
              <Markdown content={template.content} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onCopy(template)}>
                <Icon name="copy" />
                Copy
              </Button>
              <Button onClick={() => onApply(template)}>
                <Icon name="file-text" />
                Apply
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function TemplatesPage() {
  const customTemplates = useTemplatesStore((s) => s.customTemplates)
  const builtinOverrides = useTemplatesStore((s) => s.builtinOverrides)
  const hiddenBuiltins = useTemplatesStore((s) => s.hiddenBuiltins)
  const favorites = useTemplatesStore((s) => s.favorites)
  const usage = useTemplatesStore((s) => s.usage)
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate)
  const restoreDefaults = useTemplatesStore((s) => s.restoreDefaults)
  const duplicateTemplate = useTemplatesStore((s) => s.duplicateTemplate)
  const toggleFavorite = useTemplatesStore((s) => s.toggleFavorite)
  const recordUse = useTemplatesStore((s) => s.recordUse)
  const importTemplates = useTemplatesStore((s) => s.importTemplates)

  const templates = useMemo(
    () =>
      resolveTemplates({ customTemplates, builtinOverrides, hiddenBuiltins }),
    [customTemplates, builtinOverrides, hiddenBuiltins],
  )
  const canRestore =
    hiddenBuiltins.length > 0 || Object.keys(builtinOverrides).length > 0

  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [composeMode, setComposeMode] = useState(false)
  const [selectedForCompose, setSelectedForCompose] = useState<Set<string>>(
    new Set(),
  )
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PromptTemplate | null>(
    null,
  )
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [apply, setApply] = useState<ApplyState | null>(null)
  const [copyTemplate, setCopyTemplate] = useState<PromptTemplate | null>(null)

  const previewTemplate = previewId
    ? (templates.find((t) => t.id === previewId) ?? null)
    : null

  const allTags = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
    return [...set].sort()
  }, [templates])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = templates.filter((t) => {
      if (favoritesOnly && !favorites.includes(t.id)) return false
      if (activeTag && !t.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
    const isFav = (id: string) => favorites.includes(id)
    const usedAt = (id: string) => usage[id]?.at ?? 0
    // Pinned first, then most-recently used, then the resolved order (stable).
    return [...filtered].sort((a, b) => {
      if (isFav(a.id) !== isFav(b.id)) return isFav(a.id) ? -1 : 1
      return usedAt(b.id) - usedAt(a.id)
    })
  }, [templates, search, activeTag, favoritesOnly, favorites, usage])

  const openApply = (t: PromptTemplate) =>
    setApply({
      source: { title: t.title, content: t.content, agentIds: t.agentIds },
      ids: [t.id],
    })

  // The command palette can ask to apply a template by id (cross-page). Resolve
  // the live list from the store inside the callbacks so setState never runs
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const applyById = (id: string | null) => {
      if (!id) return
      const s = useTemplatesStore.getState()
      const t = resolveTemplates({
        customTemplates: s.customTemplates,
        builtinOverrides: s.builtinOverrides,
        hiddenBuiltins: s.hiddenBuiltins,
      }).find((x) => x.id === id)
      if (t) openApply(t)
    }
    // A request that arrived before this page mounted (deferred to a microtask).
    void Promise.resolve().then(() =>
      applyById(useTemplatesIntent.getState().consume()),
    )
    // Requests while already on this page.
    return useTemplatesIntent.subscribe(() =>
      applyById(useTemplatesIntent.getState().consume()),
    )
  }, [])

  const copy = (t: PromptTemplate) => {
    if (hasVariables(t.content)) {
      setCopyTemplate(t)
      return
    }
    void navigator.clipboard.writeText(t.content)
    recordUse(t.id)
    setNotice(`Copied “${t.title}”.`)
  }

  const toggleCompose = (id: string) =>
    setSelectedForCompose((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const applyCompose = () => {
    const chosen = templates.filter((t) => selectedForCompose.has(t.id))
    if (chosen.length === 0) return
    setApply({
      source: {
        title: `Combined (${chosen.length} templates)`,
        content: composeTemplates(chosen.map((c) => c.content)),
      },
      ids: chosen.map((c) => c.id),
    })
  }

  const exportPack = async () => {
    const pack: TemplatePack = {
      kind: 'abyss-template-pack',
      version: 1,
      templates: templates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        tags: t.tags,
        content: t.content,
        agentIds: t.agentIds,
      })),
    }
    const { path } = await ipc.templatesExport(pack, 'abyss')
    if (path) setNotice(`Exported ${pack.templates.length} templates.`)
  }

  const importPack = async () => {
    const res = await ipc.templatesImport()
    if (res.error) {
      setNotice(res.error)
      return
    }
    if (!res.templates) return
    const n = importTemplates(
      res.templates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        tags: t.tags,
        content: t.content,
        agentIds: t.agentIds,
      })),
    )
    setNotice(`Imported ${n} template${n === 1 ? '' : 's'}.`)
  }

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (t: PromptTemplate) => {
    setEditing(t)
    setEditorOpen(true)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <PageHeader
        title="Prompt Templates"
        description="Reusable system prompts and rule sets. Apply one to add it to an agent's instructions."
        icon="library"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void importPack()}
            >
              <Icon name="upload" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportPack()}
            >
              <Icon name="download" />
              Export
            </Button>
            {canRestore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreOpen(true)}
              >
                <Icon name="rotate-ccw" />
                Restore defaults
              </Button>
            )}
            <Button size="sm" onClick={openNew}>
              <Icon name="plus" />
              New template
            </Button>
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
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="pl-8"
          />
        </div>
        <Button
          variant={favoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <Icon
            name="star"
            className={cn('size-4', favoritesOnly && 'fill-current')}
          />
          Favorites
        </Button>
        <Button
          variant={composeMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setComposeMode((v) => !v)
            setSelectedForCompose(new Set())
          }}
        >
          <Icon name="layers" />
          Combine
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              activeTag === null
                ? 'border-primary/50 bg-accent text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent/60',
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag((t) => (t === tag ? null : tag))}
              className={cn(
                'rounded-full border px-2.5 py-0.5 font-code text-xs transition-colors',
                activeTag === tag
                  ? 'border-primary/50 bg-accent text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/60',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {composeMode && selectedForCompose.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-accent px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="layers" className="size-4 shrink-0" />
            {selectedForCompose.size} selected to combine
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedForCompose(new Set())}
            >
              Clear
            </Button>
            <Button size="sm" onClick={applyCompose}>
              Combine &amp; apply
            </Button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No templates match your filters.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const edited = t.builtin && t.id in builtinOverrides
            const isFav = favorites.includes(t.id)
            const isSelected = selectedForCompose.has(t.id)
            return (
              <Card
                key={t.id}
                className={cn(
                  'flex flex-col gap-2 p-4',
                  composeMode && isSelected && 'ring-2 ring-primary',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{t.title}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {t.builtin
                      ? edited && <Badge variant="secondary">edited</Badge>
                      : !composeMode && <Badge variant="muted">custom</Badge>}
                    {composeMode ? (
                      <button
                        type="button"
                        onClick={() => toggleCompose(t.id)}
                        aria-label="Select to combine"
                        className={cn(
                          'flex size-5 items-center justify-center rounded border',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border',
                        )}
                      >
                        {isSelected && <Icon name="check" className="size-3" />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleFavorite(t.id)}
                        aria-label={isFav ? 'Unpin' : 'Pin'}
                        title={isFav ? 'Unpin' : 'Pin to top'}
                        className={cn(
                          'transition-colors',
                          isFav
                            ? 'text-warning'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon
                          name="star"
                          className={cn('size-4', isFav && 'fill-current')}
                        />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="font-code text-[10px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    composeMode ? toggleCompose(t.id) : setPreviewId(t.id)
                  }
                  title={composeMode ? 'Select to combine' : 'Open preview'}
                  className="group block w-full text-left"
                >
                  <pre className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-code text-[11px] text-muted-foreground transition-colors group-hover:bg-muted">
                    {t.content}
                  </pre>
                </button>
                {!composeMode && (
                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => openApply(t)}
                    >
                      <Icon name="file-text" />
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPreviewId(t.id)}
                      aria-label="Preview"
                      title="Preview"
                    >
                      <Icon name="eye" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => copy(t)}
                      aria-label="Copy"
                      title="Copy"
                    >
                      <Icon name="copy" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        const id = duplicateTemplate(t)
                        setNotice(`Duplicated “${t.title}”.`)
                        void id
                      }}
                      aria-label="Duplicate"
                      title="Duplicate"
                    >
                      <Icon name="files" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(t)}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Icon name="pencil" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingDelete(t)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Icon name="trash" />
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <TemplateEditorDialog
        key={editorOpen ? (editing ? `edit-${editing.id}` : 'new') : 'closed'}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
      />

      <TemplatePreviewDialog
        template={previewTemplate}
        onOpenChange={(v) => {
          if (!v) setPreviewId(null)
        }}
        onApply={(t) => {
          setPreviewId(null)
          openApply(t)
        }}
        onCopy={(t) => {
          setPreviewId(null)
          copy(t)
        }}
      />

      <TemplateApplyDialog
        key={apply ? `${apply.ids.join(',')}-${apply.source.title}` : 'closed'}
        open={apply !== null}
        onOpenChange={(v) => {
          if (!v) setApply(null)
        }}
        source={apply?.source ?? null}
        onApplied={({ count, title }) => {
          apply?.ids.forEach((id) => recordUse(id))
          setComposeMode(false)
          setSelectedForCompose(new Set())
          setNotice(
            `Applied “${title}” to ${count} agent${count === 1 ? '' : 's'}.`,
          )
        }}
      />

      <VariablesDialog
        key={copyTemplate?.id ?? 'closed'}
        open={copyTemplate !== null}
        onOpenChange={(v) => {
          if (!v) setCopyTemplate(null)
        }}
        title={copyTemplate?.title ?? ''}
        content={copyTemplate?.content ?? ''}
        submitLabel="Copy"
        onSubmit={(substituted) => {
          void navigator.clipboard.writeText(substituted)
          if (copyTemplate) recordUse(copyTemplate.id)
          setNotice(`Copied “${copyTemplate?.title ?? ''}”.`)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Delete “${pendingDelete?.title ?? ''}”?`}
        description={
          pendingDelete?.builtin
            ? 'This hides the built-in template. Restore defaults brings it back.'
            : 'This permanently removes the custom template.'
        }
        confirmLabel="Delete"
        onConfirm={() => {
          const t = pendingDelete
          setPendingDelete(null)
          if (t) removeTemplate(t.id)
        }}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore default templates?"
        description="This undoes edits and deletions of the built-in templates. Your custom templates are kept."
        confirmLabel="Restore"
        destructive={false}
        onConfirm={() => {
          restoreDefaults()
          setRestoreOpen(false)
        }}
      />
    </div>
  )
}
