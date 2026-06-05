import { Input } from '@/shared/components/ui/input'
import { normalizeHex } from '../lib/builder'

export interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="h-8 font-code text-xs uppercase"
        />
      </div>
    </div>
  )
}
