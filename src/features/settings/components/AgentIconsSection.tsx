import type { ChangeEvent } from 'react'
import type { AgentAdapter } from '@/shared/types/agent'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { AgentIcon } from '@/features/agents/components/AgentIcon'
import { AgentAvatar } from '@/features/agents/components/AgentAvatar'
import { useAgentIconStore } from '@/features/agents/store/agent-icon.store'
import {
  BRAND_ICON_CHOICES,
  LUCIDE_ICON_CHOICES,
  type IconChoice,
} from '@/features/agents/lib/agent-icons'

const CHOICES: IconChoice[] = [...BRAND_ICON_CHOICES, ...LUCIDE_ICON_CHOICES]

/** A single selectable icon swatch. */
function Swatch({
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
        'flex size-10 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground transition-colors',
        selected
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-border hover:border-primary/50',
      )}
    >
      <AgentIcon icon={value} alt={label} className="size-5" />
    </button>
  )
}

function AgentIconRow({ agent }: { agent: AgentAdapter }) {
  const current = useAgentIconStore((s) => s.icons[agent.id] ?? agent.icon)
  const overridden = useAgentIconStore((s) => agent.id in s.icons)
  const setIcon = useAgentIconStore((s) => s.setIcon)
  const resetIcon = useAgentIconStore((s) => s.resetIcon)

  const isCustom = current.startsWith('data:')
  const inputId = `agent-icon-upload-${agent.id}`

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setIcon(agent.id, reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AgentAvatar agent={agent} className="size-10" />
            <div>
              <CardTitle>{agent.displayName}</CardTitle>
              <CardDescription className="font-code text-xs">
                {overridden ? 'custom icon' : 'default icon'}
              </CardDescription>
            </div>
          </div>
          {overridden && (
            <button
              type="button"
              onClick={() => resetIcon(agent.id)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon name="rotate-ccw" className="size-3.5" />
              Reset
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((choice) => (
            <Swatch
              key={choice.value}
              value={choice.value}
              label={choice.label}
              selected={current === choice.value}
              onSelect={() => setIcon(agent.id, choice.value)}
            />
          ))}

          <label
            htmlFor={inputId}
            title="Upload a custom image"
            className={cn(
              'flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors',
              isCustom
                ? 'border-primary bg-muted ring-1 ring-primary/40'
                : 'border-dashed border-border text-muted-foreground hover:border-primary/50',
            )}
          >
            {isCustom ? (
              <AgentIcon
                icon={current}
                alt="Custom icon"
                className="size-full p-1.5"
              />
            ) : (
              <Icon name="upload" className="size-4" />
            )}
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              className="hidden"
              onChange={onFile}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentIconsSection() {
  const agents = useAllAgents()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Agent Icons</CardTitle>
          <CardDescription>
            Pick the icon shown for each agent across the app — a brand logo, a
            built-in glyph, or your own uploaded image.
          </CardDescription>
        </CardHeader>
      </Card>

      {agents.map((agent) => (
        <AgentIconRow key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
