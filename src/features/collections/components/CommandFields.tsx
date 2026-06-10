import { useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
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
import { checkCommand } from '../lib/commandChecks'
import { CommandTryDialog } from './CommandTryDialog'

const PLACEHOLDERS = [
  { label: '$ARGUMENTS', insert: '$ARGUMENTS' },
  { label: '$1', insert: '$1' },
  { label: '@file', insert: '@path/to/file' },
  { label: '!`cmd`', insert: '!`command`' },
]

/**
 * Structured editor for a slash command: a frontmatter form (description /
 * argument-hint / allowed-tools / model), placeholder-insert helpers and the
 * prompt body — all derived from and written back to `cm.draft`.
 */
export function CommandFields({ cm }: { cm: CollectionController }) {
  const { data, body } = parseFrontmatter(cm.draft)
  const [tryOpen, setTryOpen] = useState(false)
  const viewRef = useRef<EditorView | null>(null)

  const setField = (key: string, value: string) =>
    cm.setDraft(serializeFrontmatter({ ...data, [key]: value }, body))
  const setBody = (next: string) =>
    cm.setDraft(serializeFrontmatter(data, next))

  const tools = parseToolList(data['allowed-tools'])
  const toolChips = [
    ...KNOWN_TOOLS,
    ...tools.filter((t) => !KNOWN_TOOLS.includes(t)),
  ]
  const toggleTool = (t: string) =>
    setField(
      'allowed-tools',
      joinToolList(
        tools.includes(t) ? tools.filter((x) => x !== t) : [...tools, t],
      ),
    )

  const insertAtCursor = (text: string) => {
    const view = viewRef.current
    if (!view) {
      setBody(body ? `${body}\n${text}` : text)
      return
    }
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
    view.focus()
  }

  const issues = checkCommand({
    description: data.description ?? '',
    argumentHint: data['argument-hint'] ?? '',
    allowedTools: data['allowed-tools'] ?? '',
    body,
  })
  const tokens = estimateTokens(cm.draft)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="cmd-hint">Argument hint</Label>
          <Input
            id="cmd-hint"
            value={data['argument-hint'] ?? ''}
            onChange={(e) => setField('argument-hint', e.target.value)}
            placeholder="[file] or <message>"
            className="font-code"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmd-model">Model</Label>
          <Input
            id="cmd-model"
            list="cmd-model-options"
            value={data.model ?? ''}
            onChange={(e) => setField('model', e.target.value)}
            placeholder="inherit"
            className="font-code"
          />
          <datalist id="cmd-model-options">
            {MODEL_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cmd-desc">Description</Label>
        <Input
          id="cmd-desc"
          value={data.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Shown in the slash menu and used by the SlashCommand tool"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Allowed tools</Label>
          {tools.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              Empty = inherit all
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
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Insert:</span>
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => insertAtCursor(p.insert)}
              className="rounded border border-border px-1.5 py-0.5 font-code text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setTryOpen(true)}>
          <Icon name="flask-conical" />
          Try
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <MarkdownEditor
          value={body}
          language="markdown"
          onChange={setBody}
          onCreateEditor={(view) => {
            viewRef.current = view
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <Badge variant="muted" className="shrink-0 font-code">
          ~{formatTokens(tokens)} tokens
        </Badge>
      </div>

      <CommandTryDialog
        key={tryOpen ? (cm.selectedId ?? 'open') : 'closed'}
        open={tryOpen}
        onOpenChange={setTryOpen}
        title={cm.selectedItem?.name ?? 'command'}
        body={body}
      />
    </div>
  )
}
