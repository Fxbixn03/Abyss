import { useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { PermissionPreset } from '../lib/presets'
import { SECURITY_PRESETS, TOPIC_PRESETS, mergeRules } from '../lib/presets'

export function PermissionPresets({
  rules,
  onChange,
}: {
  rules: PermissionRules
  onChange: (next: PermissionRules) => void
}) {
  const [pending, setPending] = useState<PermissionPreset | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Presets:</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Icon name="shield" />
            Security
            <Icon name="chevron-down" className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[280px]">
          <DropdownMenuLabel>Replace all rules</DropdownMenuLabel>
          {SECURITY_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => setPending(preset)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon name={preset.icon} className="size-3.5" />
                {preset.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {preset.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Icon name="plus" />
            Add topic
            <Icon name="chevron-down" className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[280px]">
          <DropdownMenuLabel>Merge into current rules</DropdownMenuLabel>
          {TOPIC_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onChange(mergeRules(rules, preset.rules))}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon name={preset.icon} className="size-3.5" />
                {preset.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {preset.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Apply “${pending?.label}” preset?`}
        description="This replaces all current Allow, Ask and Deny rules. You can still edit them afterwards."
        confirmLabel="Replace rules"
        destructive={false}
        onConfirm={() => {
          if (pending) onChange(pending.rules)
          setPending(null)
        }}
      />
    </div>
  )
}
