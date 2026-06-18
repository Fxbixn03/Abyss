import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils'
import { filterSlashCommands } from '../lib/slashCommands'
import type { SlashCommand } from '../lib/slashCommands'

interface SlashCommandPopoverProps {
  /** The text typed after '/' — used to filter the command list. */
  query: string
  /** Index of the currently highlighted command in the filtered list. */
  activeIndex: number
  /** Called when the user clicks or presses Enter on a command. */
  onSelect: (command: SlashCommand) => void
  /** Called when the popover should be dismissed (e.g. Escape). */
  onDismiss: () => void
}

/**
 * A small floating list of slash commands rendered above the Composer textarea.
 * The parent (Composer) controls visibility — this component is only rendered
 * when the popover should be open.
 */
export function SlashCommandPopover({
  query,
  activeIndex,
  onSelect,
  onDismiss,
}: SlashCommandPopoverProps) {
  const filtered = filterSlashCommands(query)
  const listRef = useRef<HTMLUListElement>(null)

  // Scroll the active item into view whenever the index changes.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[activeIndex] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (filtered.length === 0) return null

  return (
    // The ul itself carries the listbox role; the outer div is purely presentational.
    // onMouseDown on the ul prevents the textarea from losing focus when the user
    // clicks an item — the textarea's onBlur is not triggered.
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'absolute bottom-full left-0 right-0 mb-1 z-50',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
        'max-h-52 overflow-y-auto py-1',
      )}
    >
        {filtered.map((cmd, i) => (
          <li
            key={cmd.command}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => onSelect(cmd)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(cmd)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onDismiss()
              }
            }}
            tabIndex={-1}
            className={cn(
              'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5',
              'text-sm outline-none transition-colors',
              i === activeIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 hover:text-accent-foreground',
            )}
          >
            <span className="font-mono font-medium text-primary w-28 shrink-0 truncate">
              {cmd.command}
            </span>
            <span className="text-muted-foreground truncate">{cmd.description}</span>
          </li>
        ))}
    </ul>
  )
}
