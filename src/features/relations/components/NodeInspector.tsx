import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { KIND_ICON, KIND_LABEL, KIND_TINT } from '../lib/nodeMeta'
import { useNodeEditor } from '../hooks/useNodeEditor'
import type { RelationsController } from '../hooks/useRelations'

/** Where a non-editable node's "Open in …" button navigates. */
const OPEN_ROUTE: Partial<Record<string, { route: string; label: string }>> = {
  mcp: { route: '/mcp', label: 'Open in MCP' },
  hook: { route: '/hooks', label: 'Open in Hooks' },
  instructions: { route: '/config', label: 'Open editor' },
}

/** Right pane: edit the selected node's `.md`, or show read-only details. */
export function NodeInspector({ ctrl }: { ctrl: RelationsController }) {
  const navigate = useNavigate()
  const node = ctrl.selectedNode
  const editor = useNodeEditor(
    ctrl.agentId,
    ctrl.basePath,
    node?.collectionKind,
    node?.itemId,
  )

  // Cmd/Ctrl+S saves the open item (via a ref, so the listener stays mounted).
  const editorRef = useRef(editor)
  useEffect(() => {
    editorRef.current = editor
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const ed = editorRef.current
        if (!ed.editable || !ed.dirty) return
        e.preventDefault()
        void ed.save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!node) {
    return (
      <EmptyState
        icon="git-branch"
        title="Nothing selected"
        description="Click a node to inspect its connections, or edit its file."
      />
    )
  }

  const open = OPEN_ROUTE[node.kind]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-start gap-2">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-md ${KIND_TINT[node.kind]}`}
        >
          <Icon name={KIND_ICON[node.kind]} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{node.label}</span>
            {editor.editable && editor.dirty && (
              <Badge variant="default">unsaved</Badge>
            )}
          </div>
          <Badge variant="secondary" className="mt-0.5">
            {KIND_LABEL[node.kind]}
          </Badge>
        </div>
      </div>

      {node.description && (
        <p className="text-sm text-muted-foreground">{node.description}</p>
      )}

      {node.filePath && (
        <button
          type="button"
          onClick={() => void ipc.revealPath(node.filePath ?? '')}
          className="flex max-w-full items-center gap-1 truncate font-code text-xs text-muted-foreground hover:text-foreground"
        >
          <Icon name="folder-open" className="size-3 shrink-0" />
          <span className="truncate">{node.filePath}</span>
        </button>
      )}

      {editor.editable ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void editor.save()}
              disabled={!editor.dirty || editor.saving}
            >
              <Icon name="save" />
              {editor.saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.setDraft(editor.original)}
              disabled={!editor.dirty || editor.saving}
            >
              <Icon name="rotate-ccw" />
              Revert
            </Button>
          </div>

          {editor.externalChanged && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Icon name="alert-triangle" className="size-4 shrink-0" />
                This file changed on disk.
              </span>
              <span className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void editor.reloadFromDisk()}
                >
                  Reload
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.setExternalChanged(false)}
                >
                  Keep editing
                </Button>
              </span>
            </div>
          )}

          <div className="min-h-0 flex-1">
            <MarkdownEditor
              value={editor.draft}
              language="markdown"
              onChange={editor.setDraft}
            />
          </div>
        </>
      ) : (
        open && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => navigate(open.route)}
          >
            <Icon name="external-link" />
            {open.label}
          </Button>
        )
      )}
    </div>
  )
}
