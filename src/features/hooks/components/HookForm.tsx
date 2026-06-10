import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { MATCHER_EVENTS, supportsHookTimeout } from '@/shared/types/hooks'
import type { AgentId } from '@/shared/types/agent'
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
import { Icon } from '@/shared/components/Icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { ValidationList } from '@/features/config/components/ValidationList'
import { useSandboxIntent } from '@/features/sandbox/store/sandboxIntent.store'
import { HOOK_RECIPES } from '../lib/hookRecipes'
import { HOOK_EVENT_INFO, HOOK_EXIT_CODES } from '../lib/hookEventInfo'
import { checkHook } from '../lib/hookChecks'
import { buildSandboxSnippet } from '../lib/hookSandbox'

const MATCHER_CHIPS = ['*', 'Bash', 'Edit|Write', 'Read', 'WebFetch', 'Task']

function blank(event: HookEvent): HookEntry {
  return { id: crypto.randomUUID(), event, matcher: '', command: '' }
}

export interface HookFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: HookEntry
  /** Active agent — drives timeout support and recipe filtering. */
  agentId: AgentId
  /** Lifecycle events the active agent supports. */
  events: readonly HookEvent[]
  onSubmit: (entry: HookEntry) => void
}

export function HookForm({
  open,
  onOpenChange,
  initial,
  agentId,
  events,
  onSubmit,
}: HookFormProps) {
  const navigate = useNavigate()
  const requestCommand = useSandboxIntent((s) => s.requestCommand)
  const [draft, setDraft] = useState<HookEntry>(initial ?? blank(events[0]))
  const [seedKey, setSeedKey] = useState<string | null>(null)
  const [recipe, setRecipe] = useState('blank')
  const key = `${open}:${initial?.id ?? 'new'}`
  if (open && seedKey !== key) {
    setDraft(initial ?? blank(events[0]))
    setRecipe('blank')
    setSeedKey(key)
  }

  const usesMatcher = MATCHER_EVENTS.has(draft.event)
  const showTimeout = supportsHookTimeout(agentId)
  const eventInfo = HOOK_EVENT_INFO[draft.event]
  const issues = checkHook(draft)
  const canSubmit =
    draft.command.trim() !== '' && !issues.some((i) => i.severity === 'error')

  // Only recipes whose event the active agent supports.
  const recipes = HOOK_RECIPES.filter(
    (r) => r.id === 'blank' || events.includes(r.event),
  )

  const applyRecipe = (id: string) => {
    setRecipe(id)
    const r = HOOK_RECIPES.find((x) => x.id === id)
    if (!r || r.id === 'blank') return
    setDraft((d) => ({
      ...d,
      event: r.event,
      matcher: r.matcher,
      command: r.command,
      timeout: showTimeout ? r.timeout : undefined,
    }))
  }

  const setTimeoutValue = (raw: string) => {
    const n = Number(raw)
    setDraft((d) => ({
      ...d,
      timeout: raw.trim() === '' || !Number.isFinite(n) ? undefined : n,
    }))
  }

  const testInSandbox = () => {
    requestCommand(buildSandboxSnippet(draft))
    onOpenChange(false)
    navigate('/sandbox')
  }

  const submit = () => {
    if (!canSubmit) return
    onSubmit({
      ...draft,
      matcher: usesMatcher ? draft.matcher.trim() : '',
      timeout: showTimeout ? draft.timeout : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit hook' : 'Add hook'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!initial && recipes.length > 1 && (
            <div className="space-y-1.5">
              <Label>Start from</Label>
              <div className="flex flex-wrap gap-1.5">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => applyRecipe(r.id)}
                    title={r.description}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      recipe === r.id
                        ? 'border-primary/50 bg-accent text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent/60',
                    )}
                  >
                    <Icon name={r.icon} className="size-3" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                onChange={(e) =>
                  setDraft({ ...draft, matcher: e.target.value })
                }
                placeholder={
                  usesMatcher ? 'Bash | Edit | *' : 'n/a for this event'
                }
                disabled={!usesMatcher}
                className="font-code"
              />
            </div>
          </div>

          {eventInfo && (
            <div className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="text-foreground">{eventInfo.when}</p>
              <p>
                <span className="font-medium text-foreground/80">
                  Receives:
                </span>{' '}
                <span className="font-code">{eventInfo.receives}</span>
              </p>
              <p>
                <span className="font-medium text-foreground/80">
                  Can return:
                </span>{' '}
                {eventInfo.canReturn}
              </p>
              <p className="text-[11px]">{HOOK_EXIT_CODES}</p>
            </div>
          )}

          {usesMatcher && (
            <div className="flex flex-wrap gap-1.5">
              {MATCHER_CHIPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDraft({ ...draft, matcher: m })}
                  className={cn(
                    'rounded-full border px-2 py-0.5 font-code text-xs transition-colors',
                    draft.matcher === m
                      ? 'border-primary/50 bg-accent text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

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

          {showTimeout && (
            <div className="space-y-1.5">
              <Label htmlFor="hook-timeout">Timeout (seconds, optional)</Label>
              <Input
                id="hook-timeout"
                type="number"
                min={1}
                value={draft.timeout ?? ''}
                onChange={(e) => setTimeoutValue(e.target.value)}
                placeholder="default"
                className="font-code w-32"
              />
            </div>
          )}

          {issues.length > 0 && <ValidationList issues={issues} />}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={testInSandbox}
            disabled={draft.command.trim() === ''}
          >
            <Icon name="flask-conical" />
            Test in Sandbox
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {initial ? 'Save' : 'Add hook'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
