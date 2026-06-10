import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { ConfigLanguage } from '@/shared/types/agent'
import { Markdown } from '@/shared/components/Markdown'
import { cn } from '@/shared/lib/utils'
import { ConfigEditor } from './ConfigEditor'

type Mode = 'edit' | 'split' | 'preview'
const MODES: Mode[] = ['edit', 'split', 'preview']

/**
 * Code editor with a rendered Markdown preview (Edit / Split / Preview). For
 * non-markdown languages it falls back to the plain editor.
 */
export function MarkdownEditor({
  value,
  language,
  onChange,
  onCreateEditor,
}: {
  value: string
  language: ConfigLanguage
  onChange: (value: string) => void
  onCreateEditor?: (view: EditorView) => void
}) {
  const [mode, setMode] = useState<Mode>('edit')
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // In split mode, keep the editor and preview scrolled to the same relative
  // position so the rendered output tracks the source you're editing.
  useEffect(() => {
    if (mode !== 'split') return
    const editor =
      editorPaneRef.current?.querySelector<HTMLElement>('.cm-scroller')
    const preview = previewRef.current
    if (!editor || !preview) return

    let syncing = false
    const link = (from: HTMLElement, to: HTMLElement) => () => {
      if (syncing) return
      syncing = true
      const max = from.scrollHeight - from.clientHeight
      const ratio = max > 0 ? from.scrollTop / max : 0
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
      // Release on the next frame, after the programmatic scroll above has
      // fired its own scroll event (which we want to ignore).
      requestAnimationFrame(() => {
        syncing = false
      })
    }
    const onEditorScroll = link(editor, preview)
    const onPreviewScroll = link(preview, editor)
    editor.addEventListener('scroll', onEditorScroll, { passive: true })
    preview.addEventListener('scroll', onPreviewScroll, { passive: true })
    return () => {
      editor.removeEventListener('scroll', onEditorScroll)
      preview.removeEventListener('scroll', onPreviewScroll)
    }
  }, [mode, value])

  if (language !== 'markdown') {
    return (
      <ConfigEditor
        value={value}
        language={language}
        onChange={onChange}
        onCreateEditor={onCreateEditor}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-0.5 self-end rounded-md border border-border p-0.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-[5px] px-2 py-0.5 text-xs capitalize transition-colors',
              mode === m
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          mode === 'split' && 'grid grid-cols-2 gap-2',
        )}
      >
        {mode !== 'preview' && (
          <div ref={editorPaneRef} className="h-full min-h-0">
            <ConfigEditor
              value={value}
              language={language}
              onChange={onChange}
              onCreateEditor={onCreateEditor}
            />
          </div>
        )}
        {mode !== 'edit' && (
          <div
            ref={previewRef}
            className="h-full min-h-0 overflow-auto rounded-md border border-border bg-card/40 p-4"
          >
            <Markdown content={value} />
          </div>
        )}
      </div>
    </div>
  )
}
