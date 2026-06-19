import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Icon } from '@/shared/components/Icon'
import { useComposerDraft } from '../hooks/useComposerDraft'
import { SlashCommandPopover } from './SlashCommandPopover'
import { filterSlashCommands, getSlashState } from '../lib/slashCommands'
import type { SlashCommand } from '../lib/slashCommands'

// Character count thresholds for the live counter badge.
const CHAR_COUNT_WARN = 1_000  // amber
const CHAR_COUNT_DANGER = 4_000 // red

export interface ComposerProps {
  onSend: (text: string) => void
  onStop: () => void
  /** True while a turn is in flight. */
  busy: boolean
  disabled?: boolean
  settingsBar?: ReactNode
  /**
   * When provided, drafts are persisted across session switches.
   * Use the session id or `'new'` for the compose-new-chat state.
   */
  draftKey?: string
}

interface ComposerInnerProps extends Omit<ComposerProps, 'draftKey'> {
  initialText: string
  onTextChange: (text: string) => void
  onSubmitClear: () => void
}

/**
 * Inner implementation — always rendered once `draftKey` is resolved.
 * Accepts the initial text so the draft store can seed the textarea on mount.
 */
function ComposerInner({
  onSend,
  onStop,
  busy,
  disabled,
  settingsBar,
  initialText,
  onTextChange,
  onSubmitClear,
}: ComposerInnerProps) {
  const { t } = useTranslation('chats')
  const [text, setText] = useState(initialText)

  // Track whether the textarea has ever been focused and whether it's currently focused.
  // The hint appears once the user has focused the textarea at least once and
  // only when composer is not busy or disabled.
  const [hasFocused, setHasFocused] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  // Slash-command popover state — declared before usage in callbacks.
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  // A one-shot dismiss flag: if the user presses Escape while the popover is
  // open, we hide it without altering their text. It resets the next time they
  // type or change the input.
  const [slashDismissed, setSlashDismissed] = useState(false)

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
    onSubmitClear()
    setText('')
  }

  const { open: slashOpen, query: slashQuery } = getSlashState(text)
  const filteredCount = filterSlashCommands(slashQuery).length
  const showPopover = slashOpen && !slashDismissed && filteredCount > 0

  const handleSelectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      setText(cmd.command)
      onTextChange(cmd.command)
      setSlashActiveIndex(0)
      setSlashDismissed(false)
      // Return focus to the textarea after selection.
      textareaRef.current?.focus()
    },
    [onTextChange],
  )

  const handleDismissSlash = useCallback(() => {
    setSlashDismissed(true)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash-command popover navigation first.
    if (showPopover) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashActiveIndex((prev) => Math.min(prev + 1, filteredCount - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashActiveIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const filtered = filterSlashCommands(slashQuery)
        const cmd = filtered[slashActiveIndex]
        if (cmd) {
          handleSelectSlashCommand(cmd)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleDismissSlash()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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

  const textareaLabel = disabled
    ? t('composer.placeholderDisabled')
    : t('composer.placeholderActive')

  const charCount = text.length
  const showCounter = !busy && !disabled && charCount > 0
  // Show the hint once the textarea has been focused at least once AND composer is active.
  const showHint = !busy && !disabled && (isFocused ? text.length > 0 : hasFocused)
  const counterClass =
    charCount >= CHAR_COUNT_DANGER
      ? 'text-destructive'
      : charCount >= CHAR_COUNT_WARN
        ? 'text-yellow-500'
        : 'text-muted-foreground'

  return (
    <form
      aria-label={t('composer.formLabel')}
      aria-busy={busy}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {settingsBar}
      <div className="relative flex items-end gap-2">
        {showPopover && (
          <SlashCommandPopover
            query={slashQuery}
            activeIndex={slashActiveIndex}
            onSelect={handleSelectSlashCommand}
            onDismiss={handleDismissSlash}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            onTextChange(next)
            // Typing resets the history cursor.
            historyIndex.current = history.current.length
            // Reset dismiss flag and active index when text changes.
            setSlashDismissed(false)
            setSlashActiveIndex(0)
          }}
          onFocus={() => {
            setIsFocused(true)
            setHasFocused(true)
          }}
          onBlur={() => {
            setIsFocused(false)
          }}
          onKeyDown={handleKeyDown}
          placeholder={textareaLabel}
          aria-label={textareaLabel}
          disabled={disabled}
          className="max-h-48 min-h-[44px] resize-none overflow-y-auto border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        {busy ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onStop}
            title={t('composer.stop')}
            aria-label={t('composer.stop')}
          >
            <Icon name="square" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={disabled || text.trim() === ''}
            title={t('composer.send')}
            aria-label={t('composer.send')}
          >
            <Icon name="send" />
          </Button>
        )}
      </div>
      {showHint && (
        <p
          aria-hidden="true"
          className="select-none text-[11px] text-muted-foreground/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {t('composer.sendHint')}
        </p>
      )}
      {showCounter && (
        <div className="flex justify-end">
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`text-xs tabular-nums select-none ${counterClass}`}
          >
            {charCount.toLocaleString()}
          </span>
        </div>
      )}
    </form>
  )
}

/**
 * Draft-aware wrapper that reads/writes the per-session draft store when
 * `draftKey` is provided. When `draftKey` is omitted the component behaves
 * exactly as before (no persistence).
 */
function ComposerWithDraft({
  draftKey,
  ...rest
}: ComposerProps & { draftKey: string }) {
  const { initialText, saveDraft, clearDraft } = useComposerDraft(draftKey)

  return (
    <ComposerInner
      {...rest}
      initialText={initialText}
      onTextChange={saveDraft}
      onSubmitClear={clearDraft}
    />
  )
}

/** Public export — `draftKey` is optional; omitting it disables persistence. */
export function Composer({ draftKey, ...rest }: ComposerProps) {
  if (draftKey !== undefined) {
    return <ComposerWithDraft draftKey={draftKey} {...rest} />
  }
  return (
    <ComposerInner
      {...rest}
      initialText=""
      onTextChange={() => undefined}
      onSubmitClear={() => undefined}
    />
  )
}
