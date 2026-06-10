import { useMemo, useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
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
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { isValidRule } from '../lib/glob'

const LABELS: Record<keyof PermissionRules, string> = {
  allow: 'Allow',
  ask: 'Ask',
  deny: 'Deny',
}

interface ParsedLine {
  rule: string
  valid: boolean
  /** Already present in this column (will be skipped). */
  duplicate: boolean
}

/**
 * Paste many rules at once — one per line. Blank lines are ignored, each line
 * is validated, duplicates against the existing column are skipped, and only
 * the valid/new lines are added on confirm.
 */
export function BulkAddRules({
  category,
  existing,
  onAdd,
}: {
  category: keyof PermissionRules
  existing: string[]
  onAdd: (rules: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const parsed = useMemo<ParsedLine[]>(() => {
    const have = new Set(existing.map((r) => r.trim()))
    const seen = new Set<string>()
    const out: ParsedLine[] = []
    for (const raw of text.split('\n')) {
      const rule = raw.trim()
      if (!rule || seen.has(rule)) continue
      seen.add(rule)
      out.push({ rule, valid: isValidRule(rule), duplicate: have.has(rule) })
    }
    return out
  }, [text, existing])

  const toAdd = parsed.filter((p) => p.valid && !p.duplicate)
  const invalid = parsed.filter((p) => !p.valid)

  const confirm = () => {
    if (toAdd.length) onAdd(toAdd.map((p) => p.rule))
    setText('')
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setText('')
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <Icon name="list-plus" />
        Bulk add
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add multiple {LABELS[category]} rules</DialogTitle>
          <DialogDescription>
            One rule per line. Blank lines and duplicates are ignored; invalid
            lines are skipped.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Bash(npm run test:*)\nRead(./src/**)\nEdit(**/*.ts)'}
          className="min-h-[140px] font-code text-xs"
        />

        {parsed.length > 0 && (
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
            {parsed.map((p) => (
              <div
                key={p.rule}
                className="flex items-center gap-2 text-xs"
                title={
                  !p.valid
                    ? 'Invalid format — will be skipped'
                    : p.duplicate
                      ? 'Already present — will be skipped'
                      : 'Will be added'
                }
              >
                <Icon
                  name={
                    !p.valid
                      ? 'circle-alert'
                      : p.duplicate
                        ? 'minus'
                        : 'circle-check'
                  }
                  className={cn(
                    'size-3.5 shrink-0',
                    !p.valid
                      ? 'text-warning'
                      : p.duplicate
                        ? 'text-muted-foreground'
                        : 'text-success',
                  )}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-code',
                    (p.duplicate || !p.valid) && 'text-muted-foreground',
                  )}
                >
                  {p.rule}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={toAdd.length === 0}>
            Add {toAdd.length || ''} rule{toAdd.length === 1 ? '' : 's'}
            {invalid.length > 0 && (
              <span className="text-xs opacity-70">
                ({invalid.length} skipped)
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
