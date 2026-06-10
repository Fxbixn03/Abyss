import { useState } from 'react'
import type { CollectionKind } from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'
import type { CollectionLayout } from '@/shared/types/agent'
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
import type { NewItemValues } from '../lib/templates'
import {
  KNOWN_TOOLS,
  MODEL_SUGGESTIONS,
  parseToolList,
  joinToolList,
} from '../lib/tools'
import { SUBAGENT_SCAFFOLDS } from '../lib/subagentScaffolds'
import { COMMAND_SCAFFOLDS } from '../lib/commandScaffolds'
import { SKILL_SCAFFOLDS } from '../lib/skillScaffolds'

const ID_RE = /^[A-Za-z0-9._-]+$/

export interface NewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CollectionKind
  /** Per-agent label override (e.g. Codex commands → "Prompt"). */
  label?: NonNullable<CollectionLayout['label']>
  existingIds: string[]
  onCreate: (values: NewItemValues) => void
}

export function NewItemDialog({
  open,
  onOpenChange,
  kind,
  label,
  existingIds,
  onCreate,
}: NewItemDialogProps) {
  const labels = label ?? COLLECTION_LABELS[kind]
  const isAgents = kind === 'agents'
  const isCommands = kind === 'commands'
  const isSkills = kind === 'skills'
  const showTools = isAgents || isCommands || isSkills
  const scaffolds = isAgents
    ? SUBAGENT_SCAFFOLDS
    : isCommands
      ? COMMAND_SCAFFOLDS
      : isSkills
        ? SKILL_SCAFFOLDS
        : []

  const [id, setId] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [tools, setTools] = useState('')
  const [argumentHint, setArgumentHint] = useState('')
  const [body, setBody] = useState('')
  const [scaffold, setScaffold] = useState('blank')

  // Re-seed fields each time the dialog opens.
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) {
    setId('')
    setDescription('')
    setModel(isAgents ? 'sonnet' : '')
    setTools('')
    setArgumentHint('')
    setBody('')
    setScaffold('blank')
    setSeeded(true)
  }
  if (!open && seeded) setSeeded(false)

  const applyScaffold = (scaffoldId: string) => {
    setScaffold(scaffoldId)
    if (isCommands) {
      const s = COMMAND_SCAFFOLDS.find((x) => x.id === scaffoldId)
      if (!s) return
      if (s.id !== 'blank' && id.trim() === '') setId(s.suggestedId)
      setDescription(s.description)
      setArgumentHint(s.argumentHint)
      setTools(s.allowedTools)
      setBody(s.body)
      return
    }
    if (isSkills) {
      const s = SKILL_SCAFFOLDS.find((x) => x.id === scaffoldId)
      if (!s) return
      if (s.id !== 'blank' && id.trim() === '') setId(s.suggestedId)
      setDescription(s.description)
      setTools(s.allowedTools)
      setBody(s.body)
      return
    }
    const s = SUBAGENT_SCAFFOLDS.find((x) => x.id === scaffoldId)
    if (!s) return
    if (s.id !== 'blank') {
      if (id.trim() === '') setId(s.suggestedId)
      setDescription(s.description)
      setModel(s.model)
      setTools(s.tools)
      setBody(s.body)
    } else {
      setBody('')
    }
  }

  const toolList = parseToolList(tools)
  const toolChips = [
    ...KNOWN_TOOLS,
    ...toolList.filter((t) => !KNOWN_TOOLS.includes(t)),
  ]
  const toggleTool = (t: string) =>
    setTools(
      joinToolList(
        toolList.includes(t)
          ? toolList.filter((x) => x !== t)
          : [...toolList, t],
      ),
    )

  const idError =
    id.trim() === ''
      ? null
      : !ID_RE.test(id.trim())
        ? 'Only letters, numbers, dot, dash and underscore.'
        : existingIds.includes(id.trim())
          ? 'An item with this id already exists.'
          : null
  const canCreate = id.trim() !== '' && idError === null

  const submit = () => {
    if (!canCreate) return
    onCreate({
      id: id.trim(),
      name: id.trim(),
      description,
      model: isAgents || isCommands ? model : undefined,
      tools: showTools ? tools : undefined,
      argumentHint: isCommands ? argumentHint : undefined,
      body: showTools ? body : undefined,
    })
    onOpenChange(false)
  }

  const toolsLabel = isAgents ? 'Tools' : 'Allowed tools'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New {labels.singular}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {scaffolds.length > 0 && (
            <div className="space-y-1.5">
              <Label>Start from</Label>
              <div className="flex flex-wrap gap-1.5">
                {scaffolds.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyScaffold(s.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      scaffold === s.id
                        ? 'border-primary/50 bg-accent text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent/60',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="item-id">
              {kind === 'skills' ? 'Folder name / id' : 'File name / id'}
            </Label>
            <Input
              id="item-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-helper"
              className="font-code"
              autoFocus
            />
            {idError && <p className="text-xs text-destructive">{idError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Input
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it does and when to use it"
            />
          </div>

          {isCommands && (
            <div className="space-y-1.5">
              <Label htmlFor="item-hint">Argument hint</Label>
              <Input
                id="item-hint"
                value={argumentHint}
                onChange={(e) => setArgumentHint(e.target.value)}
                placeholder="[file] or <message>"
                className="font-code"
              />
            </div>
          )}

          {(isAgents || isCommands) && (
            <div className="space-y-1.5">
              <Label htmlFor="item-model">Model</Label>
              <Input
                id="item-model"
                list="new-model-options"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="inherit"
                className="font-code"
              />
              <datalist id="new-model-options">
                {MODEL_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          )}

          {showTools && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{toolsLabel}</Label>
                {toolList.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    Empty = inherit all
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {toolChips.map((t) => {
                  const on = toolList.includes(t)
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
