import { useState } from 'react'
import type { PermissionMode, PermissionRules } from '@/shared/types/config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { toast } from 'sonner'
import { mergeRules } from '../lib/presets'

const MODES: PermissionMode[] = [
  'default',
  'acceptEdits',
  'plan',
  'bypassPermissions',
]

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** Coerces arbitrary parsed JSON into a safe PermissionRules object. */
function sanitize(data: unknown): PermissionRules | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  // A valid export has at least one of the three columns.
  if (!('allow' in o) && !('deny' in o) && !('ask' in o)) return null
  const mode = o.defaultMode
  return {
    allow: strings(o.allow),
    deny: strings(o.deny),
    ask: strings(o.ask),
    defaultMode: MODES.includes(mode as PermissionMode)
      ? (mode as PermissionMode)
      : 'default',
    additionalDirectories: strings(o.additionalDirectories),
  }
}

/** Export the permissions block to JSON / import it from a file. */
export function PermissionShare({
  rules,
  onChange,
}: {
  rules: PermissionRules
  onChange: (next: PermissionRules) => void
}) {
  const [pending, setPending] = useState<PermissionRules | null>(null)

  const exportRules = async () => {
    const payload = {
      allow: rules.allow,
      ask: rules.ask,
      deny: rules.deny,
      defaultMode: rules.defaultMode,
      additionalDirectories: rules.additionalDirectories,
    }
    const { path } = await ipc.saveTextFile(JSON.stringify(payload, null, 2), {
      defaultName: 'permissions.json',
      title: 'Export permissions',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (path) toast.success('Permissions exported')
  }

  const importRules = async () => {
    const { path } = await ipc.pickFile({
      title: 'Import permissions',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    const { content, exists } = await ipc.readTextFile(path)
    if (!exists) return
    try {
      const parsed = sanitize(JSON.parse(content))
      if (!parsed) {
        toast.error('Not a valid permissions file')
        return
      }
      setPending(parsed)
    } catch {
      toast.error('Could not read JSON')
    }
  }

  const apply = (mode: 'replace' | 'merge') => {
    if (!pending) return
    onChange(mode === 'merge' ? mergeRules(rules, pending) : pending)
    setPending(null)
    toast.success(mode === 'merge' ? 'Permissions merged' : 'Permissions replaced')
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={exportRules}>
        <Icon name="upload" />
        Export
      </Button>
      <Button variant="outline" size="sm" onClick={importRules}>
        <Icon name="download" />
        Import
      </Button>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import permissions</DialogTitle>
            <DialogDescription>
              {pending &&
                `Found ${pending.allow.length} allow, ${pending.ask.length} ask and ${pending.deny.length} deny rules. Replace your current rules, or merge them in?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => apply('merge')}>
              Merge
            </Button>
            <Button onClick={() => apply('replace')}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
