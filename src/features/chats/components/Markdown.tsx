import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ipc } from '@/shared/ipc/ipc.client'
import { cn } from '@/shared/lib/utils'

/**
 * Chat message markdown renderer. Renders to React elements (no raw HTML, no
 * `dangerouslySetInnerHTML`) so it stays CSP-safe, and maps every element to
 * semantic theme tokens instead of hard-coded colors. GFM adds tables, task
 * lists, strikethrough and autolinks. Links open in the system browser.
 */

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
  pre: ({ children }) => (
    <pre className="my-2 max-h-[28rem] overflow-auto rounded-md border border-border bg-muted/50 p-3 font-code text-xs leading-relaxed">
      {children}
    </pre>
  ),
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
