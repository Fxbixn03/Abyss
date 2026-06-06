import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useInstructionsBase } from '@/features/scope/hooks/useScopedBase'
import { useConfigStore } from '../store/config.store'
import { ConfigEditorPanel } from '../components/ConfigEditorPanel'

export function ConfigPage() {
  const agent = useActiveAgent()
  const basePath = useInstructionsBase(agent.id)
  const open = useConfigStore((s) => s.open)
  const navigate = useNavigate()

  const specs = agent.getConfigFileSpecs()
  const [selectedId, setSelectedId] = useState<string | undefined>(specs[0]?.id)
  const selectedSpec =
    specs.find((s) => s.id === selectedId) ?? specs[0] ?? null

  useEffect(() => {
    if (selectedSpec && basePath) void open(agent.id, selectedSpec, basePath)
  }, [agent, selectedSpec, basePath, open])

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader
          title="Instructions"
          description={`Configuration files for ${agent.displayName}`}
          icon="file-text"
        />
        <EmptyState
          icon="folder"
          title="No config location set"
          description={`Abyss could not find a config directory for ${agent.displayName}. Set one in Settings to start editing.`}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              Open Settings
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Instructions"
        description={`Configuration files for ${agent.displayName}`}
        icon="file-text"
        actions={<Badge variant="muted">global scope</Badge>}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-4">
        <aside className="flex flex-col gap-1 overflow-y-auto">
          {specs.map((spec) => {
            const active = spec.id === selectedSpec?.id
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => setSelectedId(spec.id)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-primary/50 bg-accent'
                    : 'border-transparent hover:bg-accent/60',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon
                    name="file-text"
                    className="size-4 text-muted-foreground"
                  />
                  {spec.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {spec.description}
                </span>
              </button>
            )
          })}
        </aside>

        <section className="min-h-0 rounded-lg border border-border bg-card/40 p-4">
          <ConfigEditorPanel />
        </section>
      </div>
    </div>
  )
}
