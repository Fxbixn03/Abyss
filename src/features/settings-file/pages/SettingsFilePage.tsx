import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RawSettingsFile } from '@/shared/types/ipc'
import type { ValidationIssue } from '@/shared/types/agent'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { ConfigEditor } from '@/features/config/components/ConfigEditor'
import { ValidationList } from '@/features/config/components/ValidationList'
import { DiffPreviewDialog } from '@/features/config/components/DiffPreviewDialog'

const FILES: RawSettingsFile[] = ['settings.json', 'settings.local.json']

function validateJson(content: string): ValidationIssue[] {
  if (content.trim() === '') return []
  try {
    JSON.parse(content)
    return []
  } catch (error) {
    return [
      {
        severity: 'error',
        message: error instanceof Error ? error.message : 'Invalid JSON.',
      },
    ]
  }
}

export function SettingsFilePage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const confirmDiff = useSettingsStore((s) => s.settings.confirmDiffBeforeSave)
  const supported = agent.capabilities.rawSettings

  const [file, setFile] = useState<RawSettingsFile>('settings.json')
  const [original, setOriginal] = useState('')
  const [draft, setDraft] = useState('')
  const [filePath, setFilePath] = useState('')
  const [exists, setExists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)

  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.readRawSettings(basePath, file).then((r) => {
      if (!active) return
      setOriginal(r.content)
      setDraft(r.content)
      setFilePath(r.path)
      setExists(r.exists)
    })
    return () => {
      active = false
    }
  }, [supported, basePath, file])

  const issues = useMemo(() => validateJson(draft), [draft])
  const dirty = draft !== original
  const hasErrors = issues.length > 0

  const performSave = async () => {
    if (!basePath) return
    setSaving(true)
    await ipc.writeRawSettings(basePath, file, draft)
    setOriginal(draft)
    setExists(true)
    setSaving(false)
    setDiffOpen(false)
  }

  const requestSave = () => {
    if (!dirty || hasErrors) return
    if (confirmDiff) setDiffOpen(true)
    else void performSave()
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Settings (raw)" icon="braces" />
        <EmptyState
          icon="braces"
          title={`${agent.displayName} has no raw settings`}
          description="Switch to an agent that exposes settings.json."
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Settings (raw)" icon="braces" />
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings first."
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
        title="Settings (raw)"
        description={`Direct JSON for ${agent.displayName}`}
        icon="braces"
        actions={
          <Button
            size="sm"
            onClick={requestSave}
            disabled={!dirty || saving || hasErrors}
          >
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {FILES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFile(f)}
            className={cn(
              'rounded-md px-3 py-1.5 font-code text-xs font-medium transition-colors',
              f === file
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-1">
          {!exists && <Badge variant="warning">new</Badge>}
          {dirty && <Badge variant="default">unsaved</Badge>}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ConfigEditor value={draft} language="json" onChange={setDraft} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <button
          type="button"
          onClick={() => void ipc.revealPath(filePath)}
          className="shrink-0 truncate font-code text-[11px] text-muted-foreground hover:text-foreground"
        >
          {filePath}
        </button>
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
    </div>
  )
}
