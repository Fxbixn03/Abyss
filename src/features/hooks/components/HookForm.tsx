import { useState } from 'react'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { MATCHER_EVENTS } from '@/shared/types/hooks'
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
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

function blank(event: HookEvent): HookEntry {
  return { id: crypto.randomUUID(), event, matcher: '', command: '' }
}

export interface HookFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: HookEntry
  /** Lifecycle events the active agent supports. */
  events: readonly HookEvent[]
  onSubmit: (entry: HookEntry) => void
}

export function HookForm({
  open,
  onOpenChange,
  initial,
  events,
  onSubmit,
}: HookFormProps) {
  const [draft, setDraft] = useState<HookEntry>(initial ?? blank(events[0]))
  const [seedKey, setSeedKey] = useState<string | null>(null)
  const key = `${open}:${initial?.id ?? 'new'}`
  if (open && seedKey !== key) {
    setDraft(initial ?? blank(events[0]))
    setSeedKey(key)
  }

  const usesMatcher = MATCHER_EVENTS.has(draft.event)
  const canSubmit = draft.command.trim() !== ''

  const submit = () => {
    if (!canSubmit) return
    onSubmit({ ...draft, matcher: usesMatcher ? draft.matcher.trim() : '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit hook' : 'Add hook'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Event</Label>
              <Select
                value={draft.event}
                onValueChange={(v) =>
                  setDraft({ ...draft, event: v as HookEvent })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event} value={event}>
                      {event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hook-matcher">Matcher</Label>
              <Input
                id="hook-matcher"
                value={draft.matcher}
                onChange={(e) => setDraft({ ...draft, matcher: e.target.value })}
                placeholder={usesMatcher ? 'Bash | Edit | *' : 'n/a for this event'}
                disabled={!usesMatcher}
                className="font-code"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hook-command">Command</Label>
            <Textarea
              id="hook-command"
              value={draft.command}
              onChange={(e) => setDraft({ ...draft, command: e.target.value })}
              placeholder="$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh"
              className="font-code min-h-[88px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {initial ? 'Save' : 'Add hook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
