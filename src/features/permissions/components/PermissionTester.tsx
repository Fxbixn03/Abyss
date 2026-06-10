import { useMemo, useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { evaluate, type Decision } from '../lib/evaluate'

const DECISION_META: Record<
  Decision,
  { label: string; variant: 'success' | 'warning' | 'danger'; icon: string }
> = {
  allow: { label: 'Allowed', variant: 'success', icon: 'circle-check' },
  ask: { label: 'Asks first', variant: 'warning', icon: 'circle-help' },
  deny: { label: 'Blocked', variant: 'danger', icon: 'shield-x' },
}

const EXAMPLES = ['Bash(rm -rf /)', 'Read(./.env)', 'Bash(npm run test)']

/**
 * "Test a rule" simulator — type a concrete tool call and instantly see the
 * decision Claude Code would reach and which rule produced it, without an agent
 * run. Triggered from the page header.
 */
export function PermissionTester({ rules }: { rules: PermissionRules }) {
  const [open, setOpen] = useState(false)
  const [call, setCall] = useState('')

  const result = useMemo(
    () => (call.trim() ? evaluate(rules, call) : null),
    [rules, call],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setCall('')
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon name="flask-conical" />
        Test rule
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Test a tool call</DialogTitle>
          <DialogDescription>
            Enter a call to see whether it would be allowed, asked or blocked —
            and which rule decides it.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={call}
          onChange={(e) => setCall(e.target.value)}
          placeholder="Bash(rm -rf /)"
          className="font-code"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setCall(ex)}
              className="rounded border border-border px-1.5 py-0.5 font-code text-[11px] text-muted-foreground transition-colors hover:bg-muted"
            >
              {ex}
            </button>
          ))}
        </div>

        {result && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Badge variant={DECISION_META[result.decision].variant}>
                <Icon name={DECISION_META[result.decision].icon} />
                {DECISION_META[result.decision].label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {result.matchedRule ? (
                <>
                  Matched{' '}
                  <span className="font-code text-foreground">
                    {result.matchedRule}
                  </span>{' '}
                  in the{' '}
                  <span className={cn('font-medium uppercase')}>
                    {result.column}
                  </span>{' '}
                  column.
                </>
              ) : (
                'No rule matches — Claude Code falls back to asking for confirmation.'
              )}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
