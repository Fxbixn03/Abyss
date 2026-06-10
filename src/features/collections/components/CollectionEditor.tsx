import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ipc } from '@/shared/ipc/ipc.client'
import type { AgentAdapter } from '@/shared/types/agent'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import {
  joinPath,
  useProjectDir,
  useScope,
} from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useSandboxIntent } from '@/features/sandbox/store/sandboxIntent.store'
import type { CollectionController } from '../hooks/useCollectionManager'
import { parseFrontmatter } from '../lib/frontmatter'
import { SubagentFields } from './SubagentFields'
import { SubagentRelations } from './SubagentRelations'

/** Right pane: header (path + actions), external-change banner and the editor. */
export function CollectionEditor({ cm }: { cm: CollectionController }) {
  const { labels, icon, selectedItem, filePath, dirty, saving, kind } = cm
  const navigate = useNavigate()
  const { scope, projectDir: scopedProjectDir } = useScope()
  const projectDir = useProjectDir()
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  const requestPrompt = useSandboxIntent((s) => s.requestPrompt)
  const allAgents = useAllAgents()

  const [relationsOpen, setRelationsOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<AgentAdapter | null>(null)

  const isAgents = kind === 'agents'
  const otherAgents = allAgents.filter(
    (a) => a.id !== cm.agentId && a.capabilities[kind],
  )

  const targetBase = (id: string): string =>
    scope === 'global'
      ? getBasePath(id)
      : scopedProjectDir
        ? joinPath(scopedProjectDir, `.${id}`)
        : ''

  const doCopyTo = async (target: AgentAdapter) => {
    if (!cm.selectedId) return
    const base = targetBase(target.id)
    if (!base) {
      toast.error(`No config location for ${target.displayName}.`)
      return
    }
    try {
      await ipc.writeCollectionItem(
        target.id,
        base,
        kind,
        cm.selectedId,
        cm.draft,
      )
      toast.success(
        `Copied “${selectedItem?.name ?? cm.selectedId}” to ${target.displayName}.`,
      )
    } catch {
      toast.error(`Couldn't copy to ${target.displayName}.`)
    }
  }

  const runInSandbox = () => {
    const { body } = parseFrontmatter(cm.draft)
    requestPrompt({ system: body.trim(), user: '' })
    navigate('/sandbox')
  }

  if (!selectedItem) {
    return (
      <EmptyState
        icon={icon}
        title={`No ${labels.singular.toLowerCase()} selected`}
        description={`Pick a ${labels.singular.toLowerCase()} to edit, or create a new one.`}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedItem.name}</span>
            {dirty && <Badge variant="default">unsaved</Badge>}
          </div>
          {filePath && (
            <button
              type="button"
              onClick={() => void ipc.revealPath(filePath)}
              className="flex max-w-full items-center gap-1 truncate font-code text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon name="folder-open" className="size-3 shrink-0" />
              <span className="truncate">{filePath}</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isAgents && (
            <>
              <Button
                variant={relationsOpen ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRelationsOpen((v) => !v)}
              >
                <Icon name="git-compare" />
                Relations
              </Button>
              <Button variant="ghost" size="sm" onClick={runInSandbox}>
                <Icon name="flask-conical" />
                Sandbox
              </Button>
            </>
          )}
          {otherAgents.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Icon name="arrow-left-right" />
                  Copy to
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  Copy to {labels.singular.toLowerCase()} of
                </DropdownMenuLabel>
                {otherAgents.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => setCopyTarget(a)}>
                    {a.displayName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setHistoryOpen(true)}
            disabled={!filePath}
          >
            <Icon name="history" />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setDeleteOpen(true)}
          >
            <Icon name="trash" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setDraft(cm.original)}
            disabled={!dirty || saving}
          >
            <Icon name="rotate-ccw" />
            Revert
          </Button>
          <Button
            size="sm"
            onClick={cm.requestSave}
            disabled={!dirty || saving}
          >
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {cm.externalChanged && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="alert-triangle" className="size-4 shrink-0" />
            This file changed on disk.
          </span>
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void cm.reloadFromDisk()}
            >
              Reload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cm.setExternalChanged(false)}
            >
              Keep editing
            </Button>
          </span>
        </div>
      )}

      {isAgents && relationsOpen && (
        <SubagentRelations
          agentId={cm.agentId}
          basePath={cm.basePath}
          projectDir={projectDir}
          subagentId={selectedItem.id}
        />
      )}

      <div className="min-h-0 flex-1">
        {isAgents ? (
          <SubagentFields cm={cm} />
        ) : (
          <MarkdownEditor
            value={cm.draft}
            language="markdown"
            onChange={cm.setDraft}
          />
        )}
      </div>

      <ConfirmDialog
        open={copyTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCopyTarget(null)
        }}
        title={`Copy to ${copyTarget?.displayName ?? ''}?`}
        description={`This writes “${selectedItem.id}” into ${
          copyTarget?.displayName ?? ''
        }'s ${labels.plural.toLowerCase()} (${scope} scope), overwriting any existing file with that id.`}
        confirmLabel="Copy"
        destructive={false}
        onConfirm={() => {
          const t = copyTarget
          setCopyTarget(null)
          if (t) void doCopyTo(t)
        }}
      />
    </div>
  )
}
