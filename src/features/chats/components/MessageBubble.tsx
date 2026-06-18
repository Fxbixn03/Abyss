import { useState, useId, memo } from 'react'
import type { ReactNode, MouseEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatBlock, ChatMessage } from '@/shared/types/chat'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { cn } from '@/shared/lib/utils'
import { Markdown } from '@/shared/components/Markdown'
import { relativeTime } from '@/features/chats/lib/format'
import { Button } from '@/shared/components/ui/button'
import { estimateCostUsd, formatMoney } from '@/shared/lib/cost'
import { useSettingsStore } from '@/features/settings/store/settings.store'

function CollapsibleBlock({
  icon,
  label,
  defaultOpen = false,
  tone = 'muted',
  copyText,
  children,
}: {
  icon: string
  label: string
  defaultOpen?: boolean
  tone?: 'muted' | 'error'
  copyText?: string
  children: ReactNode
}) {
  const { t } = useTranslation('chats')
  const [open, setOpen] = useState(defaultOpen)
  const [copiedBlock, setCopiedBlock] = useState(false)
  const contentId = useId()

  function handleCopyBlock(e: MouseEvent) {
    e.stopPropagation()
    if (!copyText) return
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopiedBlock(true)
      setTimeout(() => setCopiedBlock(false), 1500)
    })
  }

  function handleToggleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    }
  }

  return (
    <div
      className={cn(
        'group/block overflow-hidden rounded-md border text-xs',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-muted/40',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleToggleKeyDown}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left font-medium text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Icon name={icon} className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        {copyText !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/block:opacity-100"
            title={copiedBlock ? t('messageBubble.copy.copied') : t('messageBubble.copy.copy')}
            aria-label={copiedBlock ? t('messageBubble.copy.copiedToClipboard') : t('messageBubble.copy.copyToClipboard')}
            onClick={handleCopyBlock}
          >
            <Icon
              name={copiedBlock ? 'check' : 'copy'}
              className="size-3.5"
            />
          </Button>
        )}
        <Icon
          name={open ? 'chevron-down' : 'chevron-right'}
          className={cn('size-3.5 shrink-0', copyText === undefined && 'ml-auto')}
        />
      </div>
      {open && (
        <div id={contentId} className="border-t border-border/60 px-2.5 py-2">
          {children}
        </div>
      )}
    </div>
  )
}

function BlockView({
  block,
  showCursor,
}: {
  block: ChatBlock
  showCursor?: boolean
}) {
  const { t } = useTranslation('chats')

  switch (block.kind) {
    case 'text':
      return (
        <>
          <Markdown content={block.text} />
          {showCursor && (
            <span
              aria-hidden="true"
              className="motion-safe:animate-blink inline-block h-[1em] w-px bg-current align-middle ml-0.5"
            />
          )}
        </>
      )
    case 'thinking':
      return (
        <CollapsibleBlock icon="brain" label={t('messageBubble.blocks.thinking')}>
          <div className="text-muted-foreground">
            <Markdown content={block.text} />
          </div>
        </CollapsibleBlock>
      )
    case 'tool_use':
      return (
        <CollapsibleBlock
          icon="wrench"
          label={t('messageBubble.blocks.tool', { name: block.name })}
          copyText={JSON.stringify(block.input, null, 2)}
        >
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-code">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </CollapsibleBlock>
      )
    case 'tool_result':
      return (
        <CollapsibleBlock
          icon="terminal"
          label={block.isError ? t('messageBubble.blocks.toolResultError') : t('messageBubble.blocks.toolResult')}
          tone={block.isError ? 'error' : 'muted'}
          copyText={block.output}
        >
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-code">
            {block.output || '(empty)'}
          </pre>
        </CollapsibleBlock>
      )
    case 'image':
      return <div className="text-xs italic text-muted-foreground">{t('messageBubble.blocks.image')}</div>
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

const ROLE_ICONS: Record<string, string> = {
  user: 'user',
  assistant: 'bot',
  system: 'sliders',
}

type MessageBubbleProps = {
  message: ChatMessage
  /** Display name of the agent driving the chat (used for assistant turns). */
  agentName?: string
  /** When true, renders a blinking cursor after the last text block. */
  isStreaming?: boolean
}

function areEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.message.id === next.message.id &&
    prev.message.blocks === next.message.blocks &&
    prev.message.blocks.length === next.message.blocks.length &&
    prev.message.inputTokens === next.message.inputTokens &&
    prev.message.outputTokens === next.message.outputTokens &&
    prev.isStreaming === next.isStreaming &&
    prev.agentName === next.agentName
  )
}

function MessageBubbleInner({
  message,
  agentName,
  isStreaming,
}: MessageBubbleProps) {
  const { t } = useTranslation('chats')
  const [copied, setCopied] = useState(false)
  const currency = useSettingsStore((s) => s.settings.currency)

  const roleKey = message.role in ROLE_ICONS ? message.role : 'assistant'
  const icon = ROLE_ICONS[roleKey] ?? 'bot'
  const roleLabel = t(`messageBubble.roles.${roleKey}`)
  // Label assistant turns with the actual agent (Claude, Codex, …) instead of
  // the generic "Assistant".
  const label =
    message.role === 'assistant' && agentName ? agentName : roleLabel
  const onlyToolResults =
    message.blocks.length > 0 &&
    message.blocks.every((b) => b.kind === 'tool_result')

  // Collect plain text from all text blocks for the copy button.
  const textContent = message.blocks
    .filter((b): b is Extract<ChatBlock, { kind: 'text' }> => b.kind === 'text')
    .map((b) => b.text)
    .join('\n')
  const hasTextContent = textContent.length > 0

  function handleCopy() {
    void navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const timestamp = relativeTime(message.timestamp, t)

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
        'group flex gap-3 rounded-lg px-2 py-1.5',
        message.isSidechain && 'ml-6 border-l border-border pl-3',
        message.role === 'user'
          ? 'bg-primary/8'
          : 'bg-muted/30',
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
        <Icon name={icon} className="size-3.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {message.role === 'assistant' && message.model && (
            <span className="text-xs text-muted-foreground/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {message.model}
            </span>
          )}
          {message.role === 'assistant' &&
            (message.inputTokens != null || message.outputTokens != null) && (
              <span className="font-code text-xs text-muted-foreground/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {(() => {
                  const inTok = message.inputTokens ?? 0
                  const outTok = message.outputTokens ?? 0
                  const totalTok = inTok + outTok
                  const cost = estimateCostUsd(inTok, outTok)
                  const parts: string[] = []
                  if (cost >= 0.0001) parts.push(`~${formatMoney(cost, currency)}`)
                  if (totalTok > 0) parts.push(`${totalTok.toLocaleString()} tok`)
                  return parts.join(' · ')
                })()}
              </span>
            )}
          {timestamp && (
            <span
              className="text-xs text-muted-foreground/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              aria-label={t('messageBubble.sentAt', { time: timestamp })}
            >
              {timestamp}
            </span>
          )}
          {hasTextContent && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-5 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              title={copied ? t('messageBubble.copy.copiedMessage') : t('messageBubble.copy.copyMessage')}
              aria-label={copied ? t('messageBubble.copy.copiedMessage') : t('messageBubble.copy.copyMessage')}
              onClick={handleCopy}
            >
              <Icon
                name={copied ? 'check' : 'copy'}
                className="size-3.5"
              />
            </Button>
          )}
        </div>
        {message.blocks.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Spinner className="size-3" label={t('messageBubble.thinking')} />
            {t('messageBubble.thinking')}
          </span>
        ) : (() => {
          // Find the index of the last text block so the cursor appears there.
          const lastTextIdx = isStreaming
            ? [...message.blocks].reduce<number>(
                (acc, b, i) => (b.kind === 'text' ? i : acc),
                -1,
              )
            : -1
          return message.blocks.map((block, i) => (
            <BlockView
              key={i}
              block={block}
              showCursor={i === lastTextIdx}
            />
          ))
        })()}
      </div>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleInner, areEqual)
