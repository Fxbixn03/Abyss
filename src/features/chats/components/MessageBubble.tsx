import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatBlock, ChatMessage } from '@/shared/types/chat'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'

function CollapsibleBlock({
  icon,
  label,
  defaultOpen = false,
  tone = 'muted',
  children,
}: {
  icon: string
  label: string
  defaultOpen?: boolean
  tone?: 'muted' | 'error'
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border text-xs',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-muted/40',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon name={icon} className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          className="ml-auto size-3.5 shrink-0"
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-2.5 py-2">{children}</div>
      )}
    </div>
  )
}

function BlockView({ block }: { block: ChatBlock }) {
  switch (block.kind) {
    case 'text':
      return (
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {block.text}
        </div>
      )
    case 'thinking':
      return (
        <CollapsibleBlock icon="brain" label="Thinking">
          <div className="whitespace-pre-wrap break-words font-code text-muted-foreground">
            {block.text}
          </div>
        </CollapsibleBlock>
      )
    case 'tool_use':
      return (
        <CollapsibleBlock icon="wrench" label={`Tool · ${block.name}`}>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-code">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </CollapsibleBlock>
      )
    case 'tool_result':
      return (
        <CollapsibleBlock
          icon="terminal"
          label={block.isError ? 'Tool result · error' : 'Tool result'}
          tone={block.isError ? 'error' : 'muted'}
        >
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-code">
            {block.output || '(empty)'}
          </pre>
        </CollapsibleBlock>
      )
    case 'image':
      return <div className="text-xs italic text-muted-foreground">[image]</div>
    case 'error':
      return (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
          <Icon name="circle-alert" className="mt-0.5 size-3.5 shrink-0" />
          <span className="whitespace-pre-wrap break-words">
            {block.message}
          </span>
        </div>
      )
  }
}

const ROLE_META: Record<string, { icon: string; label: string }> = {
  user: { icon: 'user', label: 'You' },
  assistant: { icon: 'bot', label: 'Assistant' },
  system: { icon: 'sliders', label: 'System' },
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const meta = ROLE_META[message.role] ?? ROLE_META.assistant
  const onlyToolResults =
    message.blocks.length > 0 &&
    message.blocks.every((b) => b.kind === 'tool_result')

  // Tool-result-only turns render as a standalone block group, not a bubble.
  if (onlyToolResults) {
    return (
      <div className="ml-9 flex flex-col gap-1.5">
        {message.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-3',
        message.isSidechain && 'ml-6 border-l border-border pl-3',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md',
          message.role === 'user'
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon name={meta.icon} className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {meta.label}
        </span>
        {message.blocks.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Icon name="loader" className="size-3 animate-spin" />
            thinking…
          </span>
        ) : (
          message.blocks.map((block, i) => <BlockView key={i} block={block} />)
        )}
      </div>
    </div>
  )
}
