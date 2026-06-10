import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { ValidationList } from '@/features/config/components/ValidationList'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import type { CollectionController } from '../hooks/useCollectionManager'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import {
  KNOWN_TOOLS,
  MODEL_SUGGESTIONS,
  parseToolList,
  joinToolList,
} from '../lib/tools'
import { checkSubagent } from '../lib/subagentChecks'

/**
 * Structured editor for a subagent: a frontmatter form (name / description /
 * model / tools) plus the system-prompt body. Everything is derived from and
 * written back to `cm.draft`, so dirty-tracking, save and history keep working.
 */
export function SubagentFields({ cm }: { cm: CollectionController }) {
  const { data, body } = parseFrontmatter(cm.draft)
  const [newTool, setNewTool] = useState('')

  const setField = (key: string, value: string) =>
    cm.setDraft(serializeFrontmatter({ ...data, [key]: value }, body))
  const setBody = (next: string) =>
    cm.setDraft(serializeFrontmatter(data, next))

  const tools = parseToolList(data.tools)
  const toolChips = [
    ...KNOWN_TOOLS,
    ...tools.filter((t) => !KNOWN_TOOLS.includes(t)),
  ]
  const toggleTool = (t: string) => {
    const next = tools.includes(t)
      ? tools.filter((x) => x !== t)
      : [...tools, t]
    setField('tools', joinToolList(next))
  }
  const addCustomTool = () => {
    const t = newTool.trim()
    if (t && !tools.includes(t)) setField('tools', joinToolList([...tools, t]))
    setNewTool('')
  }

  const siblings = cm.items
    .filter((i) => i.id !== cm.selectedId)
    .map((i) => ({ name: i.name, description: i.description }))
  const issues = checkSubagent({
    name: data.name ?? '',
    description: data.description ?? '',
    body,
    siblings,
  })
  const tokens = estimateTokens(cm.draft)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="sa-name">Name</Label>
          <Input
            id="sa-name"
            value={data.name ?? ''}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="code-reviewer"
            className="font-code"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-model">Model</Label>
          <Input
            id="sa-model"
            list="sa-model-options"
            value={data.model ?? ''}
            onChange={(e) => setField('model', e.target.value)}
            placeholder="inherit"
            className="font-code"
          />
          <datalist id="sa-model-options">
            {MODEL_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-desc">Description</Label>
        <Input
          id="sa-desc"
          value={data.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="What it does and when the agent should delegate to it"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Tools</Label>
          {tools.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Empty = inherit all tools
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toolChips.map((t) => {
            const on = tools.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTool(t)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 font-code text-xs transition-colors',
                  on
                    ? 'border-primary/50 bg-accent text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/60',
                )}
              >
                {on && <Icon name="check" className="size-3" />}
                {t}
              </button>
            )
          })}
          <input
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomTool()
              }
            }}
            onBlur={addCustomTool}
            placeholder="+ tool"
            className="w-20 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 font-code text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>System prompt</Label>
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor value={body} language="markdown" onChange={setBody} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <Badge variant="muted" className="shrink-0 font-code">
          ~{formatTokens(tokens)} tokens
        </Badge>
      </div>
    </div>
  )
}
