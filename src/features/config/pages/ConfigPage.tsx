import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import {
  useInstructionsBase,
  useScope,
} from '@/features/scope/hooks/useScopedBase'
import { useConfigStore } from '../store/config.store'
import { ConfigEditorPanel } from '../components/ConfigEditorPanel'
import { EffectiveInstructionsDialog } from '../components/EffectiveInstructionsDialog'
import { ScopeCompareDialog } from '../components/ScopeCompareDialog'
import type { ConfigFileSpec } from '@/shared/types/agent'

function basename(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export function ConfigPage() {
  const { t } = useTranslation('config')
  const agent = useActiveAgent()
  const basePath = useInstructionsBase(agent.id)
  const { scope, projectDir } = useScope()
  const open = useConfigStore((s) => s.open)
  const navigate = useNavigate()

  // Read store state for badge computation
  const storeSpec = useConfigStore((s) => s.spec)
  const storeDraft = useConfigStore((s) => s.draft)
  const storeOriginal = useConfigStore((s) => s.original)
  const storeIssues = useConfigStore((s) => s.issues)

  const [effectiveOpen, setEffectiveOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  const specs = agent.getConfigFileSpecs()
  const [selectedId, setSelectedId] = useState<string | undefined>(specs[0]?.id)
  const selectedSpec =
    specs.find((s) => s.id === selectedId) ?? specs[0] ?? null

  useEffect(() => {
    if (selectedSpec && basePath) void open(agent.id, selectedSpec, basePath)
  }, [agent, selectedSpec, basePath, open])

  /** Returns badge state for a given config file spec entry. */
  function getBadgeState(spec: ConfigFileSpec): {
    isDirty: boolean
    hasErrors: boolean
  } {
    const isActiveInStore = storeSpec?.id === spec.id
    if (!isActiveInStore) return { isDirty: false, hasErrors: false }
    return {
      isDirty: storeDraft !== storeOriginal,
      hasErrors: storeIssues.some((i) => i.severity === 'error'),
    }
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader
          title={t('title')}
          description={t('headerDescription', { agent: agent.displayName })}
          icon="file-text"
        />
        <EmptyState
          icon="folder"
          title={t('noPath.title')}
          description={t('noPath.desc', { agent: agent.displayName })}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              {t('actions.openSettings')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('headerDescription', { agent: agent.displayName })}
        icon="file-text"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="muted">
              {scope === 'project' && projectDir
                ? `project · ${basename(projectDir)}`
                : 'global scope'}
            </Badge>
            {scope === 'project' && projectDir && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareOpen(true)}
              >
                <Icon name="git-compare" />
                {t('actions.compare')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEffectiveOpen(true)}
            >
              <Icon name="layers" />
              {t('actions.effectiveView')}
            </Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-4">
        <aside className="flex flex-col gap-1 overflow-y-auto">
          {specs.map((spec) => {
            const active = spec.id === selectedSpec?.id
            const { isDirty, hasErrors } = getBadgeState(spec)
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
                  <span className="flex-1 truncate">{spec.filename}</span>
                  {hasErrors && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-destructive"
                      title={t('validationErrors')}
                      aria-label={t('validationErrors')}
                    />
                  )}
                  {!hasErrors && isDirty && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-amber-500"
                      title={t('unsavedChanges')}
                      aria-label={t('unsavedChanges')}
                    />
                  )}
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

      <EffectiveInstructionsDialog
        open={effectiveOpen}
        onOpenChange={setEffectiveOpen}
        agent={agent}
        projectDir={projectDir}
      />
      <ScopeCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        agent={agent}
        projectDir={projectDir}
      />
    </div>
  )
}
