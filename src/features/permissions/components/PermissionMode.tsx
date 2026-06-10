import type { PermissionMode as Mode } from '@/shared/types/config'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'

const MODE_OPTIONS: { value: Mode; label: string; description: string }[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Prompts the first time each tool is used, then remembers.',
  },
  {
    value: 'acceptEdits',
    label: 'Accept edits',
    description: 'Auto-accepts file edits; other tools still ask.',
  },
  {
    value: 'plan',
    label: 'Plan mode',
    description: 'Read-only — the agent plans but cannot edit or run commands.',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass permissions',
    description: 'Skips every permission prompt. Use with extreme care.',
  },
]

/** Default permission mode selector (`permissions.defaultMode`). */
export function PermissionMode({
  mode,
  onChange,
}: {
  mode: Mode | undefined
  onChange: (mode: Mode) => void
}) {
  const current: Mode = mode ?? 'default'
  const meta = MODE_OPTIONS.find((o) => o.value === current)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="sliders" className="size-4" />
          Default mode
        </CardTitle>
        <CardDescription>
          How {`Claude Code`} asks for permission when no rule decides.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={current} onValueChange={(v) => onChange(v as Mode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {meta && (
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        )}
        {current === 'bypassPermissions' && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            <Icon name="shield-alert" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              All prompts are skipped — the agent can edit files and run commands
              without confirmation. Only use in fully trusted, sandboxed setups.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
