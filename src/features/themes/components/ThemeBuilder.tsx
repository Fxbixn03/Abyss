import { useState } from 'react'
import type {
  AppearanceMode,
  BorderRadius,
  FontFamily,
  ThemeColors,
  ThemeConfig,
} from '@/shared/types/theme'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { useThemeStore } from '../store/theme.store'
import { ColorField } from './ColorField'
import { ThemePreview } from './ThemePreview'
import {
  COLOR_GROUPS,
  cloneTheme,
  colorValue,
  createDraftTheme,
  duplicateTheme,
} from '../lib/builder'

const RADII: BorderRadius[] = ['none', 'sm', 'md', 'lg']
const FONTS: FontFamily[] = ['sans', 'mono', 'mixed']
const VARIANTS: AppearanceMode[] = ['light', 'dark']

export function ThemeBuilder() {
  const customThemes = useThemeStore((s) => s.customThemes)
  const allThemes = useThemeStore((s) => s.allThemes)
  const addCustomTheme = useThemeStore((s) => s.addCustomTheme)
  const deleteTheme = useThemeStore((s) => s.deleteTheme)
  const restoreDefaults = useThemeStore((s) => s.restoreDefaults)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const getActiveTheme = useThemeStore((s) => s.getActiveTheme)
  const appearance = useThemeStore((s) => s.appearance)

  const agents = useAllAgents()
  const activeAgent = useActiveAgent()

  const [draft, setDraft] = useState<ThemeConfig>(() =>
    createDraftTheme(getActiveTheme(activeAgent.id)),
  )
  const [variant, setVariant] = useState<AppearanceMode>(appearance)

  const saved = customThemes.find((t) => t.id === draft.id)
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft)

  const setMeta = (patch: Partial<ThemeConfig>) =>
    setDraft((d) => ({ ...d, ...patch }))

  const setColor = (key: keyof ThemeColors, value: string) =>
    setDraft((d) => ({ ...d, [variant]: { ...d[variant], [key]: value } }))

  const save = () => addCustomTheme(cloneTheme(draft))
  const applyToActive = () => {
    addCustomTheme(cloneTheme(draft))
    setAgentTheme(activeAgent.id, draft.id)
  }
  const startNew = () =>
    setDraft(createDraftTheme(getActiveTheme(activeAgent.id)))
  const themeExists = allThemes().some((t) => t.id === draft.id)
  const canDelete = themeExists && allThemes().length > 1
  const removeDraft = () => {
    deleteTheme(draft.id)
    startNew()
  }
  const baseOn = (id: string) => {
    const base = allThemes().find((t) => t.id === id)
    if (base) setDraft(duplicateTheme(base))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Build your own theme. Pick colors for light and dark, preview them live,
        then save.
      </p>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Themes</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={restoreDefaults}>
              <Icon name="rotate-ccw" />
              Restore defaults
            </Button>
            <Select onValueChange={baseOn}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Duplicate from…" />
              </SelectTrigger>
              <SelectContent>
                {allThemes().map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={startNew}>
              <Icon name="plus" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allThemes().map((t) => {
              const isCustom = customThemes.some((c) => c.id === t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraft(cloneTheme(t))}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
                    t.id === draft.id
                      ? 'border-primary/50 bg-accent'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  <span
                    className="size-3 rounded-full border border-black/10"
                    style={{ background: t.dark.primary }}
                  />
                  {t.label}
                  {isCustom && (
                    <Badge variant="muted" className="text-[9px]">
                      edited
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {saved ? 'Edit theme' : 'New theme'}
              {dirty && <Badge variant="warning">unsaved</Badge>}
            </CardTitle>
            <CardDescription className="font-code text-[11px]">
              {draft.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="theme-name">Name</Label>
              <Input
                id="theme-name"
                value={draft.label}
                onChange={(e) => setMeta({ label: e.target.value })}
                placeholder="My Theme"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Scope</Label>
                <Select
                  value={draft.agentId}
                  onValueChange={(v) => setMeta({ agentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*">All agents</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Radius</Label>
                <Select
                  value={draft.borderRadius}
                  onValueChange={(v) =>
                    setMeta({ borderRadius: v as BorderRadius })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RADII.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Font</Label>
                <Select
                  value={draft.fontFamily}
                  onValueChange={(v) =>
                    setMeta({ fontFamily: v as FontFamily })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Colors</span>
              <div className="ml-auto inline-flex gap-1 rounded-md border border-border p-0.5">
                {VARIANTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      v === variant
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </span>
                  <div className="space-y-2">
                    {group.fields.map((field) => (
                      <ColorField
                        key={field.key}
                        label={field.label}
                        value={colorValue(draft[variant], field)}
                        onChange={(value) => setColor(field.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <div className="sticky top-0 flex flex-col gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Live preview · {variant}
            </span>
            <ThemePreview theme={draft} variant={variant} />

            <div className="flex flex-col gap-2">
              <Button onClick={applyToActive}>
                <Icon name="check" />
                Save &amp; use for {activeAgent.displayName}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={save}
                  disabled={!dirty}
                >
                  <Icon name="save" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onClick={removeDraft}
                  disabled={!canDelete}
                >
                  <Icon name="trash" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
