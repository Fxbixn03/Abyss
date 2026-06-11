import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { AgentCapabilities, ConfigLanguage } from '@/shared/types/agent'
import type { CustomAgentSpec } from '@/shared/agents/custom-agent'
import {
  CUSTOM_AGENT_CAPABILITY_META,
  DEFAULT_CUSTOM_AGENT_CAPABILITIES,
  DEFAULT_CUSTOM_AGENT_THEME_ID,
} from '@/shared/agents/custom-agent'
import { AGENT_DEFINITIONS } from '@/shared/agents/defs'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { useCustomAgentStore } from '@/features/agents/store/custom-agent.store'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import {
  BRAND_ICON_CHOICES,
  LUCIDE_ICON_CHOICES,
  type IconChoice,
} from '@/features/agents/lib/agent-icons'
import { useThemeStore } from '@/features/themes/store/theme.store'

const ICON_CHOICES: IconChoice[] = [...BRAND_ICON_CHOICES, ...LUCIDE_ICON_CHOICES]

const LANGUAGES: { value: ConfigLanguage; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: 'Plain text' },
]

interface CustomAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Spec to edit; `null` creates a new agent. */
  editing: CustomAgentSpec | null
}

interface FormState {
  id: string
  displayName: string
  docsUrl: string
  iconName: string
  defaultThemeId: string
  configDir: string
  filename: string
  language: ConfigLanguage
  description: string
  capabilities: AgentCapabilities
}

function emptyForm(): FormState {
  return {
    id: '',
    displayName: '',
    docsUrl: '',
    iconName: 'bot',
    defaultThemeId: DEFAULT_CUSTOM_AGENT_THEME_ID,
    configDir: '',
    filename: 'AGENTS.md',
    language: 'markdown',
    description: 'Global instructions for this agent.',
    capabilities: { ...DEFAULT_CUSTOM_AGENT_CAPABILITIES },
  }
}

function formFromSpec(spec: CustomAgentSpec): FormState {
  return {
    id: spec.id,
    displayName: spec.displayName,
    docsUrl: spec.docsUrl ?? '',
    iconName: spec.iconName,
    defaultThemeId: spec.defaultThemeId,
    configDir: spec.configDir,
    filename: spec.instructions.filename,
    language: spec.instructions.language,
    description: spec.instructions.description,
    capabilities: { ...spec.capabilities },
  }
}

/** A single selectable icon swatch (brand mark or Lucide glyph). */
function IconSwatch({
  value,
  label,
  selected,
  onSelect,
}: {
  value: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex size-9 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground transition-colors',
        selected
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-border hover:border-primary/50',
      )}
    >
      <AgentIcon icon={value} alt={label} className="size-5" />
    </button>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function CustomAgentDialog({
  open,
  onOpenChange,
  editing,
}: CustomAgentDialogProps) {
  const isEdit = editing !== null
  const save = useCustomAgentStore((s) => s.save)
  const specs = useCustomAgentStore((s) => s.specs)

  // Fresh form each time the dialog opens for a (different) agent.
  const [form, setForm] = useState<FormState>(() =>
    editing ? formFromSpec(editing) : emptyForm(),
  )
  // Track whether the user has hand-edited the config dir, so we keep
  // auto-filling `~/.id` from the id only until they take it over.
  const [dirTouched, setDirTouched] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const globalThemes = useMemo(
    () =>
      useThemeStore
        .getState()
        .allThemes()
        .filter((t) => t.agentId === '*'),
    [],
  )

  const reservedIds = useMemo(() => {
    const builtin = Object.keys(AGENT_DEFINITIONS)
    const otherCustom = specs
      .filter((s) => s.id !== editing?.id)
      .map((s) => s.id)
    return new Set([...builtin, ...otherCustom])
  }, [specs, editing])

  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }))

  const onIdChange = (raw: string) => {
    const id = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
    patch({
      id,
      configDir: dirTouched ? form.configDir : id ? `~/.${id}` : '',
    })
  }

  const toggleCap = (key: keyof AgentCapabilities, on: boolean) =>
    setForm((f) => ({ ...f, capabilities: { ...f.capabilities, [key]: on } }))

  const onUploadIcon = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') patch({ iconName: reader.result })
    }
    reader.readAsDataURL(file)
  }

  const browseDir = async () => {
    const { path } = await ipc.pickDirectory('Select config directory')
    if (path) {
      setDirTouched(true)
      patch({ configDir: path })
    }
  }

  // --- Validation ---
  const idError = !form.id
    ? 'An id is required'
    : !/^[a-z][a-z0-9-]*$/.test(form.id)
      ? 'Use lowercase letters, digits and dashes (must start with a letter)'
      : reservedIds.has(form.id)
        ? 'This id is already taken'
        : undefined
  const nameError = form.displayName.trim() ? undefined : 'A name is required'
  const fileError = form.filename.trim()
    ? undefined
    : 'An instruction filename is required'
  const dirError = form.configDir.trim()
    ? undefined
    : 'A config directory is required'
  const valid = !idError && !nameError && !fileError && !dirError

  const onSave = async () => {
    if (!valid) return
    setSaving(true)
    const spec: CustomAgentSpec = {
      id: form.id,
      displayName: form.displayName.trim(),
      iconName: form.iconName,
      defaultThemeId: form.defaultThemeId,
      docsUrl: form.docsUrl.trim() || undefined,
      capabilities: { ...form.capabilities, instructions: true },
      instructions: {
        filename: form.filename.trim(),
        language: form.language,
        description: form.description.trim(),
      },
      configDir: form.configDir.trim(),
    }
    try {
      await save(spec)
      // The main process now knows the agent (it re-registered on SetConfig);
      // refresh its detected base path so the editor resolves it this session.
      await useSettingsStore.getState().redetect(spec.id)
      toast.success(isEdit ? 'Agent updated' : `Created “${spec.displayName}”`)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isCustomImage = form.iconName.startsWith('data:')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit custom agent' : 'Create a custom agent'}
          </DialogTitle>
          <DialogDescription>
            Configure your own AI coding agent — identity, its config files and
            which features Abyss exposes for it.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[68vh] overflow-y-auto px-1">
          <div className="flex flex-col gap-6 py-1">
            {/* Identity */}
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Display name"
                  htmlFor="ca-name"
                  error={nameError}
                  hint="Shown across the app, e.g. “My Agent”."
                >
                  <Input
                    id="ca-name"
                    value={form.displayName}
                    onChange={(e) => patch({ displayName: e.target.value })}
                    placeholder="My Agent"
                  />
                </Field>
                <Field
                  label="Agent id"
                  htmlFor="ca-id"
                  error={idError}
                  hint="Lowercase slug, used on disk. Can't be changed later."
                >
                  <Input
                    id="ca-id"
                    value={form.id}
                    onChange={(e) => onIdChange(e.target.value)}
                    placeholder="my-agent"
                    disabled={isEdit}
                    className="font-code"
                  />
                </Field>
              </div>

              <Field
                label="Docs URL"
                htmlFor="ca-docs"
                hint="Optional link to the agent's documentation."
              >
                <Input
                  id="ca-docs"
                  value={form.docsUrl}
                  onChange={(e) => patch({ docsUrl: e.target.value })}
                  placeholder="https://…"
                />
              </Field>

              <Field label="Icon">
                <div className="flex flex-wrap items-center gap-2">
                  {ICON_CHOICES.map((choice) => (
                    <IconSwatch
                      key={choice.value}
                      value={choice.value}
                      label={choice.label}
                      selected={form.iconName === choice.value}
                      onSelect={() => patch({ iconName: choice.value })}
                    />
                  ))}
                  <label
                    title="Upload a custom image"
                    className={cn(
                      'flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors',
                      isCustomImage
                        ? 'border-primary bg-muted ring-1 ring-primary/40'
                        : 'border-dashed border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {isCustomImage ? (
                      <AgentIcon
                        icon={form.iconName}
                        alt="Custom icon"
                        className="size-full p-1.5"
                      />
                    ) : (
                      <Icon name="upload" className="size-4" />
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                      className="hidden"
                      onChange={onUploadIcon}
                    />
                  </label>
                </div>
              </Field>
            </section>

            {/* Config location & instruction file */}
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">
                Configuration
              </h3>
              <Field
                label="Config directory"
                htmlFor="ca-dir"
                error={dirError}
                hint="Base folder for this agent's files. A leading ~ is your home."
              >
                <div className="flex gap-2">
                  <Input
                    id="ca-dir"
                    value={form.configDir}
                    onChange={(e) => {
                      setDirTouched(true)
                      patch({ configDir: e.target.value })
                    }}
                    placeholder="~/.my-agent"
                    className="font-code"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={browseDir}
                  >
                    <Icon name="folder-open" />
                    Browse
                  </Button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Instruction file"
                  htmlFor="ca-file"
                  error={fileError}
                  hint="e.g. AGENTS.md, CLAUDE.md, GEMINI.md"
                >
                  <Input
                    id="ca-file"
                    value={form.filename}
                    onChange={(e) => patch({ filename: e.target.value })}
                    placeholder="AGENTS.md"
                    className="font-code"
                  />
                </Field>
                <Field label="File format">
                  <Select
                    value={form.language}
                    onValueChange={(v) =>
                      patch({ language: v as ConfigLanguage })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                label="File description"
                htmlFor="ca-desc"
                hint="Shown above the editor when you edit this agent's instructions."
              >
                <Textarea
                  id="ca-desc"
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={2}
                  placeholder="Global instructions for this agent."
                />
              </Field>

              <Field label="Theme">
                <Select
                  value={form.defaultThemeId}
                  onValueChange={(v) => patch({ defaultThemeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {globalThemes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </section>

            {/* Features */}
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Features
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pick which surfaces appear for this agent. Instructions are
                  always on.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CUSTOM_AGENT_CAPABILITY_META.map((cap) => (
                  <label
                    key={cap.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {cap.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {cap.description}
                      </span>
                    </span>
                    <Switch
                      checked={form.capabilities[cap.key]}
                      onCheckedChange={(on) => toggleCap(cap.key, on)}
                      aria-label={`Toggle ${cap.label}`}
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!valid || saving}>
            {isEdit ? 'Save changes' : 'Create agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
