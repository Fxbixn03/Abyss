import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  fieldsFromData,
  parseToml,
  patchField,
  type CommandFields,
} from '../lib/toml'

export interface CommandFormProps {
  /** Raw TOML — the single source of truth shared with the editor view. */
  raw: string
  /** True when the raw TOML has a syntax error: the form is read-only then. */
  disabled: boolean
  /** Patch one field and hand the re-serialized TOML back up. */
  onChange: (raw: string) => void
}

export function CommandForm({ raw, disabled, onChange }: CommandFormProps) {
  const { data } = parseToml(raw)
  const fields = fieldsFromData(data)

  const set = (key: keyof CommandFields, value: string) =>
    onChange(patchField(raw, key, value))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid gap-2">
        <Label htmlFor="gc-name">Name</Label>
        <Input
          id="gc-name"
          value={fields.name}
          disabled={disabled}
          placeholder="git:commit"
          className="font-code"
          onChange={(e) => set('name', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The slash command name, e.g. <code>/git:commit</code>.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="gc-description">Description</Label>
        <Input
          id="gc-description"
          value={fields.description}
          disabled={disabled}
          placeholder="Create a new EF Core migration."
          onChange={(e) => set('description', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the command list and when Gemini suggests the command.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-2">
        <Label htmlFor="gc-prompt">Prompt</Label>
        <Textarea
          id="gc-prompt"
          value={fields.prompt}
          disabled={disabled}
          placeholder="Analyse the changes and… Use {{args}} for arguments."
          className="min-h-[200px] flex-1 resize-none font-code text-[13px]"
          onChange={(e) => set('prompt', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The prompt sent to Gemini. <code>{'{{args}}'}</code> is replaced with
          the user's arguments.
        </p>
      </div>
    </div>
  )
}
