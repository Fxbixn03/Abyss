import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ConfigLanguage } from '@/shared/types/agent'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { ConfigEditor } from '@/features/config/components/ConfigEditor'

const SHELL_EXT = /\.(sh|bash|zsh)$/

function languageFor(path: string): ConfigLanguage {
  if (/\.json$/.test(path)) return 'json'
  if (/\.ya?ml$/.test(path)) return 'yaml'
  if (/\.md$/.test(path)) return 'markdown'
  return 'text'
}

/** Starter content for a brand-new hook script, by file type. */
function scriptTemplate(path: string): string {
  if (/\.py$/.test(path)) {
    return `#!/usr/bin/env python3
"""Hook script. Reads the event payload as JSON on stdin.
Exit 0 = ok, exit 2 = block (stderr is fed back to the agent)."""
import json
import sys

payload = json.load(sys.stdin)
# tool = payload.get("tool_name")
sys.exit(0)
`
  }
  if (/\.(js|cjs|mjs)$/.test(path)) {
    return `#!/usr/bin/env node
// Hook script. Reads the event payload as JSON on stdin.
// Exit 0 = ok, exit 2 = block (stderr is fed back to the agent).
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  const payload = JSON.parse(raw || '{}')
  // console.error(payload.tool_name)
  process.exit(0)
})
`
  }
  return `#!/usr/bin/env bash
# Hook script. Receives the event payload as JSON on stdin.
# Exit 0 = ok, exit 2 = block (stderr is fed back to the agent).
set -euo pipefail

payload="$(cat)"
# tool="$(echo "$payload" | jq -r '.tool_name')"
exit 0
`
}

export interface ScriptEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absolute, resolved path of the script the hook references. */
  scriptPath: string
  /** The raw token as written in the command (for display). */
  scriptToken: string
  /** Called after a successful save so the page can re-check existence. */
  onSaved?: () => void
}

/** Create or edit the script file a hook command points at. */
export function ScriptEditorDialog({
  open,
  onOpenChange,
  scriptPath,
  scriptToken,
  onSaved,
}: ScriptEditorDialogProps) {
  const [content, setContent] = useState('')
  const [existed, setExisted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !scriptPath) return
    let active = true
    void ipc.readTextFile(scriptPath).then((r) => {
      if (!active) return
      setExisted(r.exists)
      setContent(r.exists ? r.content : scriptTemplate(scriptPath))
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [open, scriptPath])

  const save = async () => {
    setSaving(true)
    try {
      await ipc.writeTextFile(scriptPath, content, SHELL_EXT.test(scriptPath))
      toast.success(existed ? 'Script saved' : 'Script created')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      reportError(err, { title: "Couldn't save script" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {existed ? 'Edit script' : 'Create script'}
            {!existed && loaded && (
              <Badge variant="warning" className="font-normal">
                new file
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="font-code text-xs">
            {scriptToken}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {loaded ? (
            <div className="h-[55vh]">
              <ConfigEditor
                value={content}
                language={languageFor(scriptPath)}
                onChange={setContent}
              />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => void ipc.revealPath(scriptPath)}
            disabled={!existed}
          >
            <Icon name="external-link" />
            Reveal
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={!loaded || saving}>
              <Icon name="save" />
              {existed ? 'Save' : 'Create script'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
