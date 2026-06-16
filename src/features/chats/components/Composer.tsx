import { useState, useRef, useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Icon } from '@/shared/components/Icon'

export interface ComposerProps {
  onSend: (text: string) => void
  onStop: () => void
  /** True while a turn is in flight. */
  busy: boolean
  disabled?: boolean
  settingsBar?: ReactNode
}

export function Composer({
  onSend,
  onStop,
  busy,
  disabled,
  settingsBar,
}: ComposerProps) {
  const [text, setText] = useState('')

  // Ref for the textarea DOM element — used for auto-grow height adjustment.
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow: reset to 'auto' then set to scrollHeight so the element expands
  // row-by-row. The max-h-48 CSS class enforces the ceiling; overflow-y-auto
  // (from the Textarea base styles) handles the scrollbar beyond that limit.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  // Session-scoped prompt history stored as refs so they don't cause re-renders.
  // history[0] is the oldest entry; history[history.length - 1] is the most recent.
  const history = useRef<string[]>([])
  // historyIndex === history.length means "no history entry selected" (drafting mode).
  const historyIndex = useRef<number>(0)

  const submit = () => {
    const trimmed = text.trim()
    if (trimmed === '' || disabled) return
    history.current.push(trimmed)
    historyIndex.current = history.current.length
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
      return
    }

    if (e.key === 'ArrowUp') {
      const el = e.currentTarget
      // Only navigate history when the textarea is empty or the cursor is on the first line.
      const cursorOnFirstLine =
        el.value === '' || el.selectionStart <= el.value.indexOf('\n') || !el.value.includes('\n')
      if (cursorOnFirstLine && history.current.length > 0) {
        const nextIndex = historyIndex.current - 1
        if (nextIndex >= 0) {
          e.preventDefault()
          historyIndex.current = nextIndex
          setText(history.current[nextIndex])
        }
      }
      return
    }

    if (e.key === 'ArrowDown') {
      if (historyIndex.current < history.current.length) {
        e.preventDefault()
        const nextIndex = historyIndex.current + 1
        historyIndex.current = nextIndex
        if (nextIndex >= history.current.length) {
          // Restore empty draft at end of history
          setText('')
        } else {
          setText(history.current[nextIndex])
        }
      }
      return
    }

    // Any other keystroke resets the history cursor to "drafting" position.
    historyIndex.current = history.current.length
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-2.5">
      {settingsBar}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            // Typing resets the history cursor.
            historyIndex.current = history.current.length
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'Sign in to start chatting…' : 'Message the agent…'
          }
          disabled={disabled}
          className="max-h-48 min-h-[44px] resize-none overflow-y-auto border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        {busy ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStop}
            title="Stop"
            aria-label="Stop"
          >
            <Icon name="square" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={submit}
            disabled={disabled || text.trim() === ''}
            title="Send (Enter)"
            aria-label="Send (Enter)"
          >
            <Icon name="send" />
          </Button>
        )}
      </div>
    </div>
  )
}
