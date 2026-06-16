import { useMemo, useState } from 'react'
import type { McpServerEntry } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'
import { genId } from '@/shared/lib/id'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'

/** A single entry under the `mcpServers` key of a claude.json-style snippet. */
interface RawMcpServer {
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

/** Turn a parsed `{ mcpServers: {...} }` object into entries, ignoring junk. */
function parseServers(text: string): McpServerEntry[] {
  const data = JSON.parse(text) as unknown
  if (typeof data !== 'object' || data === null || !('mcpServers' in data)) {
    throw new Error('Expected a top-level "mcpServers" object.')
  }
  const raw = (data as { mcpServers: unknown }).mcpServers
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('"mcpServers" must be an object keyed by server name.')
  }
  const out: McpServerEntry[] = []
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue
    const server = value as RawMcpServer
    const hasUrl = typeof server.url === 'string' && server.url.length > 0
    out.push({
      id: genId(),
      name,
      type: hasUrl ? 'http' : 'stdio',
      command: hasUrl ? undefined : (server.command ?? ''),
      args: Array.isArray(server.args) ? server.args : undefined,
      url: hasUrl ? server.url : undefined,
      env:
        server.env && typeof server.env === 'object' ? server.env : undefined,
      enabled: true,
    })
  }
  return out
}

export function McpImportDialog({
  open,
  onOpenChange,
  existingNames,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  onImport: (servers: McpServerEntry[]) => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    try {
      return parseServers(text)
    } catch {
      return null
    }
  }, [text])

  const existing = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  )
  const fresh = useMemo(
    () => parsed?.filter((s) => !existing.has(s.name.toLowerCase())) ?? [],
    [parsed, existing],
  )
  const dupes = (parsed?.length ?? 0) - fresh.length

  const reset = () => {
    setText('')
    setError(null)
  }

  const browse = async () => {
    const { path } = await ipc.pickFile({
      title: 'Import MCP servers',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    const { content } = await ipc.readTextFile(path)
    setText(content)
    setError(null)
  }

  const confirm = () => {
    try {
      const servers = parseServers(text)
      const toAdd = servers.filter(
        (s) => !existing.has(s.name.toLowerCase()),
      )
      onImport(toAdd)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import MCP servers</DialogTitle>
          <DialogDescription>
            Paste a claude.json-style snippet with an{' '}
            <code className="font-code">mcpServers</code> object, or load it from
            a file. Servers whose name already exists are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={'{\n  "mcpServers": {\n    "my-server": { "command": "npx", "args": ["-y", "pkg"] }\n  }\n}'}
            className="h-48 font-code text-xs"
          />

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <Icon name="triangle-alert" className="size-4" />
              {error}
            </p>
          )}

          {parsed && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="success">{fresh.length} new</Badge>
              {dupes > 0 && (
                <Badge variant="muted">{dupes} already present</Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => void browse()}>
            <Icon name="folder-open" />
            Browse…
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={fresh.length === 0}>
              <Icon name="upload" />
              Import {fresh.length > 0 ? fresh.length : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
