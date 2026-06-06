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
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useInstructionsBase } from '@/features/scope/hooks/useScopedBase'
import { useTemplatesStore } from '../store/templates.store'
import type { PromptTemplate } from '../types'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'template'
  )
}

function NewTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const addTemplate = useTemplatesStore((s) => s.addTemplate)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')

  const save = () => {
    if (!title.trim() || !content.trim()) return
    addTemplate({
      id: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
      title: title.trim(),
      description: description.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      content,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
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
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TemplatesPage() {
  const agent = useActiveAgent()
  const base = useInstructionsBase(agent.id)
  const allTemplates = useTemplatesStore((s) => s.allTemplates)
  const removeTemplate = useTemplatesStore((s) => s.removeTemplate)
  const templates = allTemplates()

  const [newOpen, setNewOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const specId = agent.getConfigFileSpecs()[0]?.id ?? 'instructions'

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

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <PageHeader
        title="Prompt Templates"
        description="Reusable system prompts and rule sets. Apply one to add it to the active agent's instructions."
        icon="library"
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Icon name="plus" />
            New template
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
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{t.title}</span>
              {!t.builtin && <Badge variant="muted">custom</Badge>}
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
            <pre className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-code text-[11px] text-muted-foreground">
              {t.content}
            </pre>
            <div className="mt-auto flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => void append(t)}
              >
                <Icon name="file-text" />
                Append to instructions
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => copy(t)}
                aria-label="Copy"
              >
                <Icon name="copy" />
              </Button>
              {!t.builtin && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeTemplate(t.id)}
                  aria-label="Delete"
                >
                  <Icon name="trash" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <NewTemplateDialog
        key={newOpen ? 'open' : 'closed'}
        open={newOpen}
        onOpenChange={setNewOpen}
      />
    </div>
  )
}
