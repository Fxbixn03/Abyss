import { useNavigate } from 'react-router-dom'
import type { CollectionKind } from '@/shared/types/collections'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { useCollectionManager } from '../hooks/useCollectionManager'
import { CollectionList } from './CollectionList'
import { CollectionEditor } from './CollectionEditor'
import { CollectionDialogs } from './CollectionDialogs'
import { CollectionNotice } from './CollectionNotice'

export interface CollectionManagerProps {
  kind: CollectionKind
  icon: string
}

/**
 * Thin orchestrator for an agent's collection of one {@link CollectionKind}
 * (skills / commands / subagents / rules). All state and behaviour live in
 * {@link useCollectionManager}; the list, editor and dialogs are presentation
 * subcomponents driven by the returned controller.
 */
export function CollectionManager({ kind, icon }: CollectionManagerProps) {
  const navigate = useNavigate()
  const cm = useCollectionManager(kind, icon)
  const { agent, labels, supported, basePath } = cm

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={labels.plural} icon={icon} />
        <EmptyState
          icon={icon}
          title={`${agent.displayName} has no ${labels.plural.toLowerCase()}`}
          description={`Switch to an agent that supports ${labels.plural.toLowerCase()}.`}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={labels.plural} icon={icon} />
        <EmptyState
          icon="folder"
          title="No config location set"
          description={`Set a config directory in Settings to manage ${labels.plural.toLowerCase()}.`}
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
        title={labels.plural}
        description={`${labels.plural} for ${agent.displayName}`}
        icon={icon}
        actions={
          <div className="flex items-center gap-2">
            {kind === 'skills' && (
              <Button
                variant="outline"
                onClick={() => void cm.startImport()}
                disabled={cm.importing}
              >
                <Icon name="download" />
                {cm.importing ? 'Importing…' : 'Import'}
              </Button>
            )}
            {kind === 'agents' && (
              <Button variant="outline" onClick={() => cm.setDiscoverOpen(true)}>
                <Icon name="globe" />
                Discover
              </Button>
            )}
            <Button onClick={() => cm.setNewOpen(true)}>
              <Icon name="file-plus" />
              New {labels.singular}
            </Button>
          </div>
        }
      />

      <CollectionNotice cm={cm} />

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-4">
        <CollectionList cm={cm} />
        <section className="min-h-0 rounded-lg border border-border bg-card/40 p-4">
          <CollectionEditor cm={cm} />
        </section>
      </div>

      <CollectionDialogs cm={cm} />
    </div>
  )
}
