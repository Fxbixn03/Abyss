import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { EditorView } from '@codemirror/view'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { EmptyState } from '@/shared/components/EmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ipc } from '@/shared/ipc/ipc.client'
import { cn } from '@/shared/lib/utils'
import { UnsavedGuard } from '@/shared/components/UnsavedGuard'
import { useFileWatch } from '@/shared/hooks/useFileWatch'
import type { AgentAdapter } from '@/shared/types/agent'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useAllAgents } from '@/features/agents/hooks/useActiveAgent'
import { useScope } from '@/features/scope/hooks/useScopedBase'
import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'
import { VariablesDialog } from '@/features/templates/components/VariablesDialog'
import { hasVariables } from '@/features/templates/lib/variables'
import type { PromptTemplate } from '@/features/templates/types'
import { useConfigStore } from '../store/config.store'
import { MarkdownEditor } from './MarkdownEditor'
import { ValidationList } from './ValidationList'
import { DiffPreviewDialog } from './DiffPreviewDialog'
import { FileHistoryDialog } from './FileHistoryDialog'
import { InsertTemplateDialog } from './InsertTemplateDialog'
import { extractOutline } from '../lib/outline'
import { SECTION_SNIPPETS } from '../lib/sections'

/** Typical large-model context window — the token budget bar is relative to it. */
const CONTEXT_WINDOW = 200_000

export function ConfigEditorPanel() {
  const agentId = useConfigStore((s) => s.agentId)
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
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  const { scope, projectDir } = useScope()
  const allAgents = useAllAgents()

  const [diffOpen, setDiffOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [externalChanged, setExternalChanged] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | null>(
    null,
  )
  const [copyTarget, setCopyTarget] = useState<AgentAdapter | null>(null)

  const editorViewRef = useRef<EditorView | null>(null)

  const isDirty = draft !== original
  const hasErrors = issues.some((i) => i.severity === 'error')
  const tokens = estimateTokens(draft)
  const pct = (tokens / CONTEXT_WINDOW) * 100
  const outline = extractOutline(draft)
  const otherAgents = allAgents.filter(
    (a) => a.id !== agentId && a.capabilities.instructions,
  )

  const onExternal = useCallback(async () => {
    const s = useConfigStore.getState()
    if (!s.agentId || !s.spec) return
    const disk = await ipc.readAgentConfig(s.agentId, s.spec.id, s.basePath)
    if (disk.content !== s.original) setExternalChanged(true)
  }, [])
  useFileWatch(filePath, onExternal)

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

  const insertIntoDraft = (content: string) => {
    const base = draft.replace(/\n+$/, '')
    setDraft((base ? `${base}\n\n` : '') + content.trim() + '\n')
  }

  const onPickTemplate = (t: PromptTemplate) => {
    setInsertOpen(false)
    if (hasVariables(t.content)) setPendingTemplate(t)
    else insertIntoDraft(t.content)
  }

  const jumpToLine = (line: number) => {
    const view = editorViewRef.current
    if (!view) return
    const target = Math.min(Math.max(1, line), view.state.doc.lines)
    const pos = view.state.doc.line(target).from
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'start' }),
    })
    view.focus()
  }

  const doCopyTo = async (target: AgentAdapter) => {
    const tspec = target.getConfigFileSpecs()[0]
    const base =
      scope === 'global' ? getBasePath(target.id) : (projectDir ?? '')
    if (!tspec || !base) {
      toast.error(`No config location for ${target.displayName}.`)
      return
    }
    try {
      await ipc.writeAgentConfig(target.id, tspec.id, base, draft)
      toast.success(
        `Copied instructions to ${target.displayName} (${tspec.filename}).`,
      )
    } catch {
      toast.error(`Couldn't copy to ${target.displayName}.`)
    }
  }

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
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant={showOutline ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowOutline((v) => !v)}
            disabled={outline.length === 0}
          >
            <Icon name="list-tree" />
            Outline
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Icon name="plus" />
                Insert
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setInsertOpen(true)}>
                <Icon name="library" />
                Prompt template…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sections</DropdownMenuLabel>
              {SECTION_SNIPPETS.map((s) => (
                <DropdownMenuItem
                  key={s.label}
                  onClick={() => insertIntoDraft(s.content)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {otherAgents.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={!draft.trim()}>
                  <Icon name="arrow-left-right" />
                  Copy to
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Copy to agent</DropdownMenuLabel>
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
            <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 font-code text-[10px] opacity-80 sm:inline">
              Ctrl S
            </kbd>
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

      {!loading && draft.trim() === '' && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon name="file-plus" className="size-4 shrink-0" />
            This file is empty — start from a template or insert a section.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInsertOpen(true)}
          >
            <Icon name="library" />
            Start from template
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2">
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
              onCreateEditor={(view) => {
                editorViewRef.current = view
              }}
            />
          )}
        </div>
        {showOutline && outline.length > 0 && (
          <aside className="w-56 shrink-0 overflow-y-auto rounded-md border border-border bg-card/40 p-2">
            <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Outline
            </div>
            {outline.map((h, i) => (
              <button
                key={`${h.line}-${i}`}
                type="button"
                onClick={() => jumpToLine(h.line)}
                style={{ paddingLeft: `${(h.level - 1) * 10 + 4}px` }}
                className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </aside>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <ValidationList issues={issues} />
        <div className="flex shrink-0 items-center gap-2 font-code text-[11px] text-muted-foreground">
          <span>~{formatTokens(tokens)} tokens</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                pct > 50 ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span>{pct < 1 ? pct.toFixed(1) : Math.round(pct)}% of ~200k</span>
        </div>
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

      <InsertTemplateDialog
        open={insertOpen}
        onOpenChange={setInsertOpen}
        onPick={onPickTemplate}
      />

      <VariablesDialog
        key={pendingTemplate?.id ?? 'none'}
        open={pendingTemplate !== null}
        onOpenChange={(o) => {
          if (!o) setPendingTemplate(null)
        }}
        title={pendingTemplate?.title ?? ''}
        content={pendingTemplate?.content ?? ''}
        submitLabel="Insert"
        onSubmit={(substituted) => insertIntoDraft(substituted)}
      />

      <ConfirmDialog
        open={copyTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCopyTarget(null)
        }}
        title={`Copy to ${copyTarget?.displayName ?? ''}?`}
        description={`This overwrites ${
          copyTarget?.getConfigFileSpecs()[0]?.filename ??
          'the instruction file'
        } for ${copyTarget?.displayName ?? ''} with the current editor content (${scope} scope).`}
        confirmLabel="Copy"
        destructive={false}
        onConfirm={() => {
          const t = copyTarget
          setCopyTarget(null)
          if (t) void doCopyTo(t)
        }}
      />

      <UnsavedGuard dirty={isDirty} />
    </div>
  )
}
