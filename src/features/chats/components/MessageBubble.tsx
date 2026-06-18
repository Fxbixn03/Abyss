import { useState, useId, memo, useMemo } from 'react'
import type { ReactNode, MouseEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatBlock, ChatMessage } from '@/shared/types/chat'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { cn } from '@/shared/lib/utils'
import { Markdown } from '@/shared/components/Markdown'
import { relativeTime } from '@/features/chats/lib/format'
import { Button } from '@/shared/components/ui/button'
import { estimateCostUsd, formatMoney } from '@/shared/lib/cost'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { AgentIcon } from '@/features/agents/components/AgentIcon'

// ── Rehype plugin for search highlighting ────────────────────────────────────
//
// A minimal hast-tree transformer that splits text nodes containing the query
// and wraps matching substrings with <mark class="highlight-match"> elements.
// Runs inside react-markdown's unified pipeline so no dangerouslySetInnerHTML
// is needed; the hast tree is turned into React elements by hast-util-to-jsx-runtime.

/**
 * Minimal hast node types used by the highlight plugin.
 * Declared inline so we don't depend on @types/hast in the renderer tsconfig.
 */
type HastText = { type: 'text'; value: string }
type HastElement = {
  type: 'element'
  tagName: string
  properties: Record<string, unknown>
  children: HastNode[]
}
type HastRoot = { type: 'root'; children: HastNode[] }
type HastNode = HastText | HastElement | HastRoot | { type: string }

function isText(node: HastNode): node is HastText {
  return node.type === 'text'
}
function isParent(
  node: HastNode,
): node is HastElement | HastRoot {
  return (
    node.type === 'element' ||
    node.type === 'root'
  )
}

/**
 * Build a rehype plugin (transformer) that wraps occurrences of `query` in
 * `<mark class="highlight-match">` hast elements.  Returns `undefined` when
 * the query is blank so we can skip registering the plugin entirely.
 */
function makeHighlightPlugin(query: string) {
  const q = query.trim()
  if (!q) return undefined

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')

  return function highlightPlugin() {
    return function transformer(tree: HastNode): void {
      // Walk the tree depth-first; mutate parent.children in-place.
      function walk(node: HastNode): void {
        if (!isParent(node)) return
        const newChildren: HastNode[] = []
        for (const child of node.children) {
          if (isText(child)) {
            const parts = child.value.split(re)
            if (parts.length === 1) {
              // No match in this text node — keep as-is.
              newChildren.push(child)
            } else {
              // Build alternating text / mark nodes.
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i]
                if (!part) continue
                if (i % 2 === 1) {
                  // Odd index → matched substring → wrap in <mark>
                  newChildren.push({
                    type: 'element',
                    tagName: 'mark',
                    properties: { className: 'highlight-match' },
                    children: [{ type: 'text', value: part }],
                  } satisfies HastElement)
                } else {
                  newChildren.push({ type: 'text', value: part } satisfies HastText)
                }
              }
            }
          } else {
            walk(child)
            newChildren.push(child)
          }
        }
        node.children = newChildren
      }
      walk(tree)
    }
  }
}

// ── HighlightedMarkdown ───────────────────────────────────────────────────────
//
// Shares the same component map as the global Markdown component (imported
// below) but adds the highlight rehype plugin so we don't duplicate the style
// definitions.  We re-use the full Components map from the shared Markdown via
// import; see Markdown.tsx for the full definition.

/** Components shared with the global Markdown — re-declared locally to avoid coupling. */
const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="my-1.5 whitespace-pre-wrap break-words leading-relaxed first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-3 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 ml-5 list-disc space-y-1 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-5 list-decimal space-y-1 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ className, children }) => {
    const text = String(children)
    const isBlock = /language-/.test(className ?? '') || text.includes('\n')
    if (isBlock) {
      return <code className={cn('font-code', className)}>{children}</code>
    }
    return (
      <code className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-code text-[0.85em] font-medium text-primary">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-1.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-1.5 align-top">
      {children}
    </td>
  ),
  img: ({ alt }) => (
    <span className="text-xs italic text-muted-foreground">
      [image{alt ? `: ${alt}` : ''}]
    </span>
  ),
  // mark: styled highlight for search matches
  mark: ({ children }) => (
    <mark className="highlight-match rounded bg-primary/20 px-0.5 text-foreground">
      {children}
    </mark>
  ),
}

/**
 * Renders markdown content with occurrences of `searchQuery` visually
 * highlighted using `<mark class="highlight-match">` elements.
 */
function HighlightedMarkdown({
  content,
  searchQuery,
}: {
  content: string
  searchQuery: string
}) {
  // Build the rehype plugin tuple memoised on the query so it's stable across
  // re-renders unless the query changes (avoids unnecessary react-markdown work).
  const rehypePlugins = useMemo(() => {
    const plugin = makeHighlightPlugin(searchQuery)
    return plugin ? [plugin] : []
  }, [searchQuery])

  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── CollapsibleBlock ─────────────────────────────────────────────────────────

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
      <div
        id={contentId}
        aria-hidden={!open}
        className={cn(
          'collapsible-block grid transition-[grid-template-rows] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-2.5 py-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function BlockView({
  block,
  showCursor,
  searchQuery,
}: {
  block: ChatBlock
  showCursor?: boolean
  searchQuery?: string
}) {
  const { t } = useTranslation('chats')

  switch (block.kind) {
    case 'text':
      return (
        <>
          {searchQuery ? (
            <HighlightedMarkdown content={block.text} searchQuery={searchQuery} />
          ) : (
            <Markdown content={block.text} />
          )}
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
  /** Resolved icon string for the active agent (lucide name, img:<key>, or data URL). */
  agentIcon?: string
  /** When true, renders a blinking cursor after the last text block. */
  isStreaming?: boolean
  /** Controls per-bubble padding and inter-block spacing. */
  density?: 'compact' | 'comfortable'
  /**
   * When non-empty and search is active, occurrences of this term inside text
   * blocks are visually highlighted with a <mark> element.
   */
  searchQuery?: string
}

function areEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.message.id === next.message.id &&
    prev.message.blocks === next.message.blocks &&
    prev.message.blocks.length === next.message.blocks.length &&
    prev.message.inputTokens === next.message.inputTokens &&
    prev.message.outputTokens === next.message.outputTokens &&
    prev.isStreaming === next.isStreaming &&
    prev.agentName === next.agentName &&
    prev.agentIcon === next.agentIcon &&
    prev.density === next.density &&
    prev.searchQuery === next.searchQuery
  )
}

function MessageBubbleInner({
  message,
  agentName,
  agentIcon,
  isStreaming,
  density = 'comfortable',
  searchQuery,
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
      <div className={cn('ml-9 flex flex-col', density === 'compact' ? 'gap-1' : 'gap-1.5')}>
        {message.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-lg px-2',
        density === 'compact' ? 'py-1' : 'py-1.5',
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
        {message.role === 'assistant' && agentIcon ? (
          <AgentIcon icon={agentIcon} className="size-3.5" />
        ) : (
          <Icon name={icon} className="size-3.5" />
        )}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col', density === 'compact' ? 'gap-1' : 'gap-1.5')}>
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
              searchQuery={searchQuery}
            />
          ))
        })()}
      </div>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleInner, areEqual)
