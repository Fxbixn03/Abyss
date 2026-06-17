import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ipc } from '@/shared/ipc/ipc.client'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'

/**
 * Shared markdown renderer (chat messages + editor previews). Renders to React
 * elements (no raw HTML, no `dangerouslySetInnerHTML`) so it stays CSP-safe, and
 * maps every element to semantic theme tokens instead of hard-coded colors. GFM
 * adds tables, task lists, strikethrough and autolinks; links open externally.
 */

/**
 * Wrapper around a fenced code block that adds a hover-reveal copy button in
 * the top-right corner, matching the pattern used in CollapsibleBlock and
 * MessageBubble.
 */
function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    // Walk the React tree to collect the raw text content of the code element.
    function extractText(node: ReactNode): string {
      if (typeof node === 'string') return node
      if (typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(extractText).join('')
      if (node !== null && typeof node === 'object' && 'props' in node) {
        const element = node as { props?: { children?: ReactNode } }
        return extractText(element.props?.children)
      }
      return ''
    }

    const text = extractText(children)
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="group/code relative">
      <pre className="my-2 max-h-[28rem] overflow-auto rounded-md border border-border bg-muted/50 p-3 font-code text-xs leading-relaxed">
        {children}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 size-5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/code:opacity-100"
        title={copied ? 'Copied!' : 'Copy code'}
        aria-label={copied ? 'Copied!' : 'Copy code to clipboard'}
        onClick={handleCopy}
      >
        <Icon name={copied ? 'check' : 'copy'} className="size-3.5" />
      </Button>
    </div>
  )
}

const components: Components = {
  p: ({ children }) => (
    <p className="my-1.5 whitespace-pre-wrap break-words leading-relaxed first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-3 text-base font-semibold first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">
      {children}
    </h2>
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
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href) void ipc.openExternal(href)
      }}
      className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </a>
  ),
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
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
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
}

function MarkdownImpl({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownImpl)
