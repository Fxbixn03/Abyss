import { useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
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
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useInstructionsBase } from '@/features/scope/hooks/useScopedBase'
import { useTemplatesStore } from '../store/templates.store'
import { BUILTIN_TEMPLATES } from '../presets'
import type { PromptTemplate } from '../types'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'template'
  )
}

/** Create a new template, or edit an existing one when `editing` is set. */
function TemplateEditorDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: PromptTemplate | null
}) {
  const addTemplate = useTemplatesStore((s) => s.addTemplate)
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '')
  const [content, setContent] = useState(editing?.content ?? '')

  const save = () => {
    if (!title.trim() || !content.trim()) return
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (editing) {
      updateTemplate({
        ...editing,
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        content,
      })
    } else {
      addTemplate({
        id: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        content,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My House Style"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Input
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-tags">Tags (comma-separated)</Label>
            <Input
              id="t-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="style, role"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-content">Content</Label>
            <Textarea
              id="t-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Role: …"
              className="min-h-[180px] font-code text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || !content.trim()}>
            {editing ? 'Save changes' : 'Save template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Read-only preview of a template's full content. */
function TemplatePreviewDialog({
  template,
  onOpenChange,
  onAppend,
  onCopy,
}: {
  template: PromptTemplate | null
  onOpenChange: (v: boolean) => void
  onAppend: (t: PromptTemplate) => void
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
              <Button onClick={() => onAppend(template)}>
                <Icon name="file-text" />
                Append to instructions
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function TemplatesPage() {
  const agent = useActiveAgent()
  const base = useInstructionsBase(agent.id)
  const customTemplates = useTemplatesStore((s) => s.customTemplates)
  const builtinOverrides = useTemplatesStore((s) => s.builtinOverrides)
  const hiddenBuiltins = useTemplatesStore((s) => s.hiddenBuiltins)
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate)
  const restoreDefaults = useTemplatesStore((s) => s.restoreDefaults)

  // Custom templates first, then built-ins (minus deleted, with edits applied).
  const templates = [
    ...customTemplates,
    ...BUILTIN_TEMPLATES.filter((t) => !hiddenBuiltins.includes(t.id)).map(
      (t) => builtinOverrides[t.id] ?? t,
    ),
  ]
  const canRestore =
    hiddenBuiltins.length > 0 || Object.keys(builtinOverrides).length > 0

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  // Track the preview by id so it follows edits and closes if the item is gone.
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PromptTemplate | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const specId = agent.getConfigFileSpecs()[0]?.id ?? 'instructions'
  const previewTemplate = previewId
    ? (templates.find((t) => t.id === previewId) ?? null)
    : null

  const append = async (t: PromptTemplate) => {
    if (!base) {
      setNotice('No config path for this agent — set one in Settings.')
      return
    }
    const existing = await ipc.readAgentConfig(agent.id, specId, base)
    const head = existing.content.replace(/\n+$/, '')
    const next = (head ? `${head}\n\n` : '') + t.content.trim() + '\n'
    await ipc.writeAgentConfig(agent.id, specId, base, next)
    setNotice(`Added “${t.title}” to ${agent.displayName} instructions.`)
  }

  const copy = (t: PromptTemplate) => {
    void navigator.clipboard.writeText(t.content)
    setNotice(`Copied “${t.title}”.`)
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
        description="Reusable system prompts and rule sets. Apply one to add it to the active agent's instructions."
        icon="library"
        actions={
          <div className="flex items-center gap-2">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const edited = t.builtin && t.id in builtinOverrides
          return (
            <Card key={t.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{t.title}</span>
                {t.builtin ? (
                  edited && <Badge variant="secondary">edited</Badge>
                ) : (
                  <Badge variant="muted">custom</Badge>
                )}
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
                onClick={() => setPreviewId(t.id)}
                title="Open preview"
                className="group block w-full text-left"
              >
                <pre className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-code text-[11px] text-muted-foreground transition-colors group-hover:bg-muted">
                  {t.content}
                </pre>
              </button>
              <div className="mt-auto flex items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => void append(t)}
                >
                  <Icon name="file-text" />
                  Append
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
            </Card>
          )
        })}
      </div>

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
        onAppend={(t) => void append(t)}
        onCopy={copy}
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
