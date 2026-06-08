import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { EmptyState } from '@/shared/components/EmptyState'
import { ipc } from '@/shared/ipc/ipc.client'
import { UnsavedGuard } from '@/shared/components/UnsavedGuard'
import { useFileWatch } from '@/shared/hooks/useFileWatch'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useConfigStore } from '../store/config.store'
import { MarkdownEditor } from './MarkdownEditor'
import { ValidationList } from './ValidationList'
import { DiffPreviewDialog } from './DiffPreviewDialog'
import { FileHistoryDialog } from './FileHistoryDialog'

export function ConfigEditorPanel() {
  const spec = useConfigStore((s) => s.spec)
  const draft = useConfigStore((s) => s.draft)
  const original = useConfigStore((s) => s.original)
  const filePath = useConfigStore((s) => s.filePath)
  const fileExists = useConfigStore((s) => s.fileExists)
  const loading = useConfigStore((s) => s.loading)
  const saving = useConfigStore((s) => s.saving)
  const issues = useConfigStore((s) => s.issues)
  const setDraft = useConfigStore((s) => s.setDraft)
  const save = useConfigStore((s) => s.save)
  const revert = useConfigStore((s) => s.revert)
  const reload = useConfigStore((s) => s.reload)

  const confirmDiff = useSettingsStore((s) => s.settings.confirmDiffBeforeSave)
  const [diffOpen, setDiffOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [externalChanged, setExternalChanged] = useState(false)

  const isDirty = draft !== original

  const onExternal = useCallback(async () => {
    const s = useConfigStore.getState()
    if (!s.agentId || !s.spec) return
    const disk = await ipc.readAgentConfig(s.agentId, s.spec.id, s.basePath)
    if (disk.content !== s.original) setExternalChanged(true)
  }, [])
  useFileWatch(filePath, onExternal)
  const hasErrors = issues.some((i) => i.severity === 'error')

  const performSave = async () => {
    try {
      await save()
      setDiffOpen(false)
    } catch {
      // save() already surfaced the failure via a toast; keep the editor open.
    }
  }

  const requestSave = () => {
    if (!isDirty || hasErrors) return
    if (confirmDiff) setDiffOpen(true)
    else void performSave()
  }

  // Ctrl/Cmd+S to save the open file.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        requestSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, hasErrors, confirmDiff, draft, original])

  if (!spec) {
    return (
      <EmptyState
        icon="file-text"
        title="No file selected"
        description="Pick a configuration file from the list to start editing."
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{spec.filename}</span>
            {!fileExists && <Badge variant="warning">new</Badge>}
            {isDirty && <Badge variant="default">unsaved</Badge>}
          </div>
          {filePath && (
            <button
              type="button"
              onClick={() => void ipc.revealPath(filePath)}
              title="Reveal in file manager"
              className="flex max-w-full items-center gap-1 truncate font-code text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon name="folder-open" className="size-3 shrink-0" />
              <span className="truncate">{filePath}</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            disabled={!filePath || !fileExists}
          >
            <Icon name="history" />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={revert}
            disabled={!isDirty || saving}
          >
            <Icon name="rotate-ccw" />
            Revert
          </Button>
          <Button
            size="sm"
            onClick={requestSave}
            disabled={!isDirty || saving || hasErrors}
          >
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {externalChanged && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="alert-triangle" className="size-4 shrink-0" />
            This file changed on disk.
          </span>
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void reload()
                setExternalChanged(false)
              }}
            >
              Reload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExternalChanged(false)}
            >
              Keep editing
            </Button>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <MarkdownEditor
            value={draft}
            language={spec.language}
            onChange={setDraft}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <span className="shrink-0 font-code text-[11px] text-muted-foreground">
          {draft.length.toLocaleString()} chars
        </span>
      </div>

      <DiffPreviewDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        filePath={filePath}
        before={original}
        after={draft}
        saving={saving}
        onConfirm={() => void performSave()}
      />

      <FileHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        filePath={filePath}
        current={original}
        onRestored={() => {
          void reload()
          setExternalChanged(false)
        }}
      />

      <UnsavedGuard dirty={isDirty} />
    </div>
  )
}
