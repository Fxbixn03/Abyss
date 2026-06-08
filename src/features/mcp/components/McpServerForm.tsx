import { useState } from 'react'
import type { McpServerEntry } from '@/shared/types/config'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { KeyValueEditor } from '@/shared/components/KeyValueEditor'
import { mcpServerSchema, fieldErrors } from '@/shared/schemas/config.schemas'

type McpType = McpServerEntry['type']

function blankEntry(): McpServerEntry {
  return {
    id: crypto.randomUUID(),
    name: '',
    type: 'stdio',
    command: '',
    args: [],
    url: '',
    env: {},
    enabled: true,
  }
}

export interface McpServerFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: McpServerEntry
  onSubmit: (entry: McpServerEntry) => void
}

export function McpServerForm({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: McpServerFormProps) {
  const [draft, setDraft] = useState<McpServerEntry>(initial ?? blankEntry())

  // Re-seed when the dialog opens for a different entry.
  const [seededFor, setSeededFor] = useState<string | null>(null)
  const seedKey = `${open}:${initial?.id ?? 'new'}`
  if (open && seededFor !== seedKey) {
    setDraft(initial ?? blankEntry())
    setSeededFor(seedKey)
  }

  const isStdio = draft.type === 'stdio'
  const parsed = mcpServerSchema.safeParse({ ...draft, name: draft.name.trim() })
  const errors = parsed.success ? {} : fieldErrors(parsed.error)
  const canSubmit = parsed.success

  const submit = () => {
    if (!parsed.success) return
    onSubmit({ ...draft, name: draft.name.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? 'Edit MCP server' : 'Add MCP server'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mcp-name">Name</Label>
              <Input
                id="mcp-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="my-server"
                className="font-code"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transport</Label>
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  setDraft({ ...draft, type: v as McpType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">stdio</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                  <SelectItem value="sse">sse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isStdio ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="mcp-command">Command</Label>
                <Input
                  id="mcp-command"
                  value={draft.command ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, command: e.target.value })
                  }
                  placeholder="npx"
                  className="font-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mcp-args">Arguments</Label>
                <Input
                  id="mcp-args"
                  value={(draft.args ?? []).join(' ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      args: e.target.value.split(/\s+/).filter(Boolean),
                    })
                  }
                  placeholder="-y @modelcontextprotocol/server-everything"
                  className="font-code"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-url">URL</Label>
              <Input
                id="mcp-url"
                value={draft.url ?? ''}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://example.com/mcp"
                className="font-code"
              />
              {errors.url && (draft.url ?? '').trim() !== '' && (
                <p className="text-xs text-destructive">{errors.url}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Environment</Label>
            <KeyValueEditor
              value={draft.env ?? {}}
              onChange={(env) => setDraft({ ...draft, env })}
              secret
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {initial ? 'Save' : 'Add server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
