import type { CodexSandboxMode } from '@/shared/types/config'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  REASONING_EFFORTS,
  SANDBOX_MODES,
  fieldsFromData,
  parseToml,
  patchField,
  type SubagentFields,
} from '../lib/toml'

/** Radix Select forbids an empty value, so an explicit sentinel means "inherit". */
const INHERIT = '__inherit__'

const SANDBOX_LABELS: Record<CodexSandboxMode, string> = {
  'read-only': 'Read-only',
  'workspace-write': 'Workspace write',
  'danger-full-access': 'Full access (dangerous)',
}

export interface SubagentFormProps {
  /** Raw TOML — the single source of truth shared with the editor view. */
  raw: string
  /** True when the raw TOML has a syntax error: the form is read-only then. */
  disabled: boolean
  /** Patch one field and hand the re-serialized TOML back up. */
  onChange: (raw: string) => void
}

export function SubagentForm({ raw, disabled, onChange }: SubagentFormProps) {
  const { data } = parseToml(raw)
  const fields = fieldsFromData(data)

  const set = (key: keyof SubagentFields, value: string | string[]) =>
    onChange(patchField(raw, key, value))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid gap-2">
        <Label htmlFor="sa-name">Name</Label>
        <Input
          id="sa-name"
          value={fields.name}
          disabled={disabled}
          placeholder="reviewer"
          className="font-code"
          onChange={(e) => set('name', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The identifier Codex uses when spawning this agent.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sa-description">Description</Label>
        <Input
          id="sa-description"
          value={fields.description}
          disabled={disabled}
          placeholder="PR reviewer focused on correctness and tests."
          onChange={(e) => set('description', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          When Codex should pick this agent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="sa-model">Model</Label>
          <Input
            id="sa-model"
            value={fields.model}
            disabled={disabled}
            placeholder="inherit"
            className="font-code"
            onChange={(e) => set('model', e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Reasoning effort</Label>
          <Select
            value={fields.model_reasoning_effort || INHERIT}
            disabled={disabled}
            onValueChange={(v) =>
              set('model_reasoning_effort', v === INHERIT ? '' : v)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>Inherit</SelectItem>
              {REASONING_EFFORTS.map((e) => (
                <SelectItem key={e} value={e} className="capitalize">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Sandbox mode</Label>
          <Select
            value={fields.sandbox_mode || INHERIT}
            disabled={disabled}
            onValueChange={(v) =>
              set('sandbox_mode', v === INHERIT ? '' : v)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>Inherit</SelectItem>
              {SANDBOX_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {SANDBOX_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sa-nicknames">Nicknames</Label>
        <Input
          id="sa-nicknames"
          value={fields.nickname_candidates.join(', ')}
          disabled={disabled}
          placeholder="Atlas, Delta, Echo"
          onChange={(e) =>
            set(
              'nickname_candidates',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated display names for spawned instances (optional).
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-2">
        <Label htmlFor="sa-instructions">Developer instructions</Label>
        <Textarea
          id="sa-instructions"
          value={fields.developer_instructions}
          disabled={disabled}
          placeholder="Review code like an owner. Prioritize correctness, security…"
          className="min-h-[160px] flex-1 resize-none font-code text-[13px]"
          onChange={(e) => set('developer_instructions', e.target.value)}
        />
      </div>
    </div>
  )
}
