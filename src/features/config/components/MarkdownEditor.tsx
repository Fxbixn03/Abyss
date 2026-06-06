import { useState } from 'react'
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
}: {
  value: string
  language: ConfigLanguage
  onChange: (value: string) => void
}) {
  const [mode, setMode] = useState<Mode>('edit')

  if (language !== 'markdown') {
    return (
      <ConfigEditor value={value} language={language} onChange={onChange} />
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
          <div className="h-full min-h-0">
            <ConfigEditor
              value={value}
              language={language}
              onChange={onChange}
            />
          </div>
        )}
        {mode !== 'edit' && (
          <div className="h-full min-h-0 overflow-auto rounded-md border border-border bg-card/40 p-4">
            <Markdown content={value} />
          </div>
        )}
      </div>
    </div>
  )
}
