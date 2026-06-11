import { useEffect, useState } from 'react'
import type { McpServerEntry, McpToolInfo } from '@/shared/types/config'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { genId } from '@/shared/lib/id'

export interface McpToolTesterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: McpServerEntry | undefined
}

interface JsonSchemaLike {
  properties?: Record<string, { type?: string }>
  required?: string[]
}

/** Seed an arguments object from a tool's JSON Schema so the user can edit it. */
function skeletonFromSchema(schema: unknown): string {
  const s = schema as JsonSchemaLike | undefined
  if (!s?.properties) return '{}'
  const obj: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(s.properties)) {
    switch (prop.type) {
      case 'string':
        obj[key] = ''
        break
      case 'number':
      case 'integer':
        obj[key] = 0
        break
      case 'boolean':
        obj[key] = false
        break
      case 'array':
        obj[key] = []
        break
      case 'object':
        obj[key] = {}
        break
      default:
        obj[key] = null
    }
  }
  return JSON.stringify(obj, null, 2)
}

type Result =
  | { kind: 'ok'; output: string; durationMs: number }
  | { kind: 'tool-error'; output: string; durationMs: number }
  | { kind: 'error'; message: string }

export function McpToolTester({ open, onOpenChange, server }: McpToolTesterProps) {
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [loadingTools, setLoadingTools] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [argsText, setArgsText] = useState('{}')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // On open, handshake with the server to discover its tools + schemas.
  useEffect(() => {
    if (!open || !server) return
    let cancelled = false
    const run = async () => {
      setTools([])
      setSelected('')
      setArgsText('{}')
      setResult(null)
      setLoadError(null)
      setLoadingTools(true)
      try {
        const health = await ipc.mcpHealthCheck(server, genId())
        if (cancelled) return
        if (!health.ok) {
          setLoadError(health.error ?? 'Server is offline.')
          return
        }
        const details = health.toolDetails ?? []
        setTools(details)
        if (details.length === 0) {
          setLoadError('This server advertised no tools.')
        }
      } catch (err) {
        if (!cancelled) setLoadError(String(err))
      } finally {
        if (!cancelled) setLoadingTools(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, server])

  const current = tools.find((t) => t.name === selected)

  const onSelect = (name: string) => {
    setSelected(name)
    setResult(null)
    const tool = tools.find((t) => t.name === name)
    setArgsText(skeletonFromSchema(tool?.inputSchema))
  }

  const run = async () => {
    if (!server || !selected) return
    let args: Record<string, unknown>
    try {
      const parsed: unknown = argsText.trim() ? JSON.parse(argsText) : {}
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Arguments must be a JSON object.')
      }
      args = parsed as Record<string, unknown>
    } catch (err) {
      setResult({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Invalid JSON.',
      })
      return
    }
    setRunning(true)
    setResult(null)
    try {
      const res = await ipc.mcpCallTool(server, selected, args, genId())
      if (!res.ok && res.error) {
        setResult({ kind: 'error', message: res.error })
      } else {
        setResult({
          kind: res.isError ? 'tool-error' : 'ok',
          output: res.output || '(no output)',
          durationMs: res.durationMs,
        })
      }
    } catch (err) {
      reportError(err, { title: "Couldn't run the tool" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Test tool{server ? ` · ${server.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loadingTools ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="loader" className="size-4 animate-spin" />
            Connecting and listing tools…
          </p>
        ) : loadError ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <Icon name="circle-alert" className="size-4" />
            {loadError}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Tool</Label>
              <Select value={selected} onValueChange={onSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a tool to run" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {current?.description && (
                <p className="text-xs text-muted-foreground">
                  {current.description}
                </p>
              )}
            </div>

            {selected && (
              <div className="space-y-1.5">
                <Label htmlFor="mcp-tool-args">Arguments (JSON)</Label>
                <Textarea
                  id="mcp-tool-args"
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  rows={6}
                  className="font-code text-xs"
                  spellCheck={false}
                />
              </div>
            )}

            {result && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Result</Label>
                  {result.kind === 'ok' && (
                    <Badge variant="success">
                      <Icon name="circle-check" />
                      ok · {result.durationMs}ms
                    </Badge>
                  )}
                  {result.kind === 'tool-error' && (
                    <Badge variant="danger">
                      <Icon name="circle-alert" />
                      tool error · {result.durationMs}ms
                    </Badge>
                  )}
                  {result.kind === 'error' && (
                    <Badge variant="danger">
                      <Icon name="circle-alert" />
                      failed
                    </Badge>
                  )}
                </div>
                <pre
                  data-selectable
                  className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-code text-xs whitespace-pre-wrap"
                >
                  {result.kind === 'error' ? result.message : result.output}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => void run()} disabled={!selected || running}>
                {running ? (
                  <Icon name="loader" className="size-4 animate-spin" />
                ) : (
                  <Icon name="play" />
                )}
                Run tool
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
