import { useState } from 'react'
import type { PermissionRules } from '@/shared/types/config'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { PermissionPreset } from '../lib/presets'
import { SECURITY_PRESETS, TOPIC_PRESETS, mergeRules } from '../lib/presets'
import { useCustomPresets } from '../store/customPresets.store'

export function PermissionPresets({
  rules,
  onChange,
}: {
  rules: PermissionRules
  onChange: (next: PermissionRules) => void
}) {
  const [pending, setPending] = useState<PermissionPreset | null>(null)
  const [savingOpen, setSavingOpen] = useState(false)
  const [name, setName] = useState('')
  const [myOpen, setMyOpen] = useState(false)
  const custom = useCustomPresets((s) => s.presets)
  const addCustom = useCustomPresets((s) => s.add)
  const removeCustom = useCustomPresets((s) => s.remove)

  const save = () => {
    if (!name.trim()) return
    addCustom(name, rules)
    setName('')
    setSavingOpen(false)
  }

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

      {custom.length > 0 && (
        <DropdownMenu open={myOpen} onOpenChange={setMyOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon name="star" />
              My presets
              <Icon name="chevron-down" className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-[280px]">
            <DropdownMenuLabel>Replace all rules</DropdownMenuLabel>
            {custom.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-1 rounded-sm px-1 hover:bg-accent"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate py-1.5 text-left text-sm"
                  onClick={() => {
                    onChange(preset.rules)
                    setMyOpen(false)
                  }}
                >
                  {preset.label}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${preset.label}`}
                  onClick={() => removeCustom(preset.id)}
                >
                  <Icon name="trash" className="text-destructive" />
                </Button>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="ghost" size="sm" onClick={() => setSavingOpen(true)}>
        <Icon name="save" />
        Save preset
      </Button>

      <Dialog open={savingOpen} onOpenChange={setSavingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <DialogDescription>
              Store the current Allow, Ask and Deny rules under a name to reuse
              them in other projects.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavingOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Apply “${pending?.label}” preset?`}
        description="This replaces all current Allow, Ask and Deny rules. You can still edit them afterwards."
        confirmLabel="Replace rules"
        destructive={false}
        onConfirm={() => {
          if (pending)
            onChange({
              ...pending.rules,
              defaultMode: rules.defaultMode,
              additionalDirectories: rules.additionalDirectories,
            })
          setPending(null)
        }}
      />
    </div>
  )
}
