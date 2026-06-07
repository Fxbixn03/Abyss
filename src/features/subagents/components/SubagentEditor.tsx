import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { UnsavedGuard } from '@/shared/components/UnsavedGuard'
import { ConfigEditor } from '@/features/config/components/ConfigEditor'
import { SubagentForm } from './SubagentForm'
import { parseToml } from '../lib/toml'

type Mode = 'form' | 'split' | 'toml'
const MODES: Mode[] = ['form', 'split', 'toml']

export interface SubagentEditorProps {
  /** Raw TOML text — the single source of truth. */
  value: string
  /** Last-saved text, to derive the dirty state. */
  savedValue: string
  /** Last parseable text — what the form shows (read-only) during a TOML error. */
  lastValidValue: string
  onChange: (raw: string) => void
  onSave: () => void
}

export function SubagentEditor({
  value,
  savedValue,
  lastValidValue,
  onChange,
  onSave,
}: SubagentEditorProps) {
  const [mode, setMode] = useState<Mode>('split')
  const { error } = parseToml(value)
  const dirty = value !== savedValue

  // The form always renders from valid TOML; on error it's read-only. The raw
  // editor is forced visible on error so a form-only view stays fixable.
  const showForm = mode !== 'toml'
  const showToml = mode !== 'form' || !!error
  const formRaw = error ? lastValidValue : value

  return (
    <div className="flex h-full flex-col gap-2">
      <UnsavedGuard dirty={dirty} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-[5px] px-2 py-0.5 text-xs uppercase tracking-wide transition-colors',
                mode === m
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <Button size="sm" disabled={!dirty || !!error} onClick={onSave}>
          <Icon name="save" className="size-4" />
          Save
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <Icon name="alert-triangle" className="size-4 shrink-0" />
          <span className="truncate">Invalid TOML: {error}</span>
        </div>
      )}

      <div
        className={cn(
          'min-h-0 flex-1',
          showForm && showToml && 'grid grid-cols-2 gap-3',
        )}
      >
        {showForm && (
          <SubagentForm raw={formRaw} disabled={!!error} onChange={onChange} />
        )}
        {showToml && (
          <div className="h-full min-h-0">
            <ConfigEditor value={value} language="text" onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}
