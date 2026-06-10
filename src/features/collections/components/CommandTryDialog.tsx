import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Icon } from '@/shared/components/Icon'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import { useSandboxIntent } from '@/features/sandbox/store/sandboxIntent.store'
import { extractArgs, applyArgs } from '../lib/commandArgs'

/**
 * Fill a command's `$ARGUMENTS` / `$1…` placeholders and preview the expanded
 * prompt, then copy it or send it to the Sandbox scratchpad. The parent remounts
 * this per command (via `key`) so the inputs reset.
 */
export function CommandTryDialog({
  open,
  onOpenChange,
  title,
  body,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  body: string
}) {
  const navigate = useNavigate()
  const requestPrompt = useSandboxIntent((s) => s.requestPrompt)
  const [values, setValues] = useState<Record<string, string>>({})

  const args = extractArgs(body)
  const expanded = applyArgs(body, values)

  const sendToSandbox = () => {
    requestPrompt({ system: '', user: expanded })
    onOpenChange(false)
    navigate('/sandbox')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Try “{title}”</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {args.length > 0 && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              {args.map((token) => (
                <div key={token} className="space-y-1">
                  <Label htmlFor={`arg-${token}`} className="font-code text-xs">
                    {token === '$ARGUMENTS' ? '$ARGUMENTS (all args)' : token}
                  </Label>
                  <Input
                    id={`arg-${token}`}
                    value={values[token] ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [token]: e.target.value }))
                    }
                    placeholder={`Value for ${token}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Expanded prompt
            </span>
            <Badge variant="muted" className="font-code">
              ~{formatTokens(estimateTokens(expanded))} tokens
            </Badge>
          </div>
          <pre className="min-h-[120px] flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 font-code text-xs">
            {expanded || ' '}
          </pre>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(expanded)}
          >
            <Icon name="copy" />
            Copy
          </Button>
          <Button onClick={sendToSandbox}>
            <Icon name="flask-conical" />
            Send to Sandbox
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
