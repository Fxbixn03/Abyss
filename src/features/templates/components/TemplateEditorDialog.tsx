import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { AgentGlyph } from '@/features/agents/components/AgentGlyph'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useTemplatesStore } from '../store/templates.store'
import { extractVariables } from '../lib/variables'
import type { PromptTemplate } from '../types'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'template'
  )
}

const SEVERITY_STYLE = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
} as const

/** Create a new template, or edit an existing one when `editing` is set. */
export function TemplateEditorDialog({
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
  const agents = useAllAgents()
  const activeAgent = useActiveAgent()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '')
  const [content, setContent] = useState(editing?.content ?? '')
  const [agentIds, setAgentIds] = useState<string[]>(editing?.agentIds ?? [])

  const variables = useMemo(() => extractVariables(content), [content])
  const issues = useMemo(() => {
    const spec = activeAgent.getConfigFileSpecs()[0]
    return spec ? activeAgent.validate(spec, content) : []
  }, [activeAgent, content])

  const toggleAgent = (id: string) =>
    setAgentIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    )

  const save = () => {
    if (!title.trim() || !content.trim()) return
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const agentList = agentIds.length > 0 ? agentIds : undefined
    if (editing) {
      updateTemplate({
        ...editing,
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        content,
        agentIds: agentList,
      })
    } else {
      addTemplate({
        id: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
        title: title.trim(),
        description: description.trim(),
        tags: tagList,
        content,
        agentIds: agentList,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit template' : 'New template'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="t-tags">Tags (comma-separated)</Label>
              <Input
                id="t-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="style, role"
              />
            </div>
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
            <Label>For agents (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => {
                const on = agentIds.includes(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                      on
                        ? 'border-primary/50 bg-accent'
                        : 'border-border text-muted-foreground hover:bg-accent/60',
                    )}
                  >
                    <AgentGlyph
                      agent={agent}
                      className="size-3.5 rounded-[3px]"
                    />
                    {agent.displayName}
                    {on && <Icon name="check" className="size-3" />}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave empty to make it available for every agent.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Content</Label>
              {variables.length > 0 && (
                <span className="font-code text-[10px] text-muted-foreground">
                  Variables: {variables.map((v) => `{{${v}}}`).join(' ')}
                </span>
              )}
            </div>
            <div className="h-[320px] min-h-0">
              <MarkdownEditor
                value={content}
                language="markdown"
                onChange={setContent}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use <code className="font-code">{'{{name}}'}</code> for values
              you’ll fill in when applying the template.
            </p>
          </div>

          {issues.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-2 text-xs">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5',
                    SEVERITY_STYLE[issue.severity],
                  )}
                >
                  <Icon
                    name="circle-alert"
                    className="mt-0.5 size-3 shrink-0"
                  />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
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
