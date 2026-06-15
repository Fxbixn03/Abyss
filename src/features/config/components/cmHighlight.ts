import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Read a CSS custom property from :root, trimmed. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Builds a CodeMirror `syntaxHighlighting` extension that maps standard
 * language tags to colors derived from the active Abyss CSS custom properties.
 *
 * Must be called at render time so it reads the *current* var values, which
 * means theme switches automatically pick up the new palette on re-render.
 * All colors use `color-mix()` over CSS vars — no hard-coded hex literals.
 */
export function buildHighlightStyle(_dark: boolean): Extension {
  const primary = cssVar('--primary')
  const mutedFg = cssVar('--muted-foreground')
  const foreground = cssVar('--foreground')

  // Derived semantic colors via color-mix() over the CSS vars already in scope.
  // These map to the typical roles in a syntax highlight scheme:
  //   heading / keyword  → primary (accent)
  //   string / inserted  → primary mixed toward foreground (greenish/teal tint)
  //   number / bool      → primary mixed toward muted (orange/amber tint)
  //   comment / meta     → muted-foreground
  //   operator/punctuation → muted-foreground, slightly stronger
  //   property name      → foreground with a primary tint
  const colorHeading = `color-mix(in srgb, ${primary} 90%, ${foreground})`
  const colorKeyword = `color-mix(in srgb, ${primary} 80%, ${foreground})`
  const colorString = `color-mix(in srgb, ${primary} 55%, ${foreground})`
  const colorNumber = `color-mix(in srgb, ${primary} 40%, ${foreground})`
  const colorComment = `color-mix(in srgb, ${mutedFg} 80%, transparent)`
  const colorMeta = mutedFg
  const colorOperator = `color-mix(in srgb, ${mutedFg} 90%, ${foreground})`
  const colorProperty = `color-mix(in srgb, ${primary} 30%, ${foreground})`

  const style = HighlightStyle.define([
    // Headings (Markdown h1–h6) — visibly distinct, bold, primary accent
    {
      tag: tags.heading,
      color: colorHeading,
      fontWeight: 'bold',
    },
    // Heading markers (#, ##, …) share the heading color
    {
      tag: tags.heading1,
      color: colorHeading,
      fontWeight: 'bold',
    },
    {
      tag: tags.heading2,
      color: `color-mix(in srgb, ${primary} 80%, ${foreground})`,
      fontWeight: 'bold',
    },
    {
      tag: tags.heading3,
      color: `color-mix(in srgb, ${primary} 70%, ${foreground})`,
      fontWeight: 'bold',
    },
    // Keywords (JSON true/false/null, YAML keys, language keywords)
    {
      tag: tags.keyword,
      color: colorKeyword,
    },
    // Property / attribute names — JSON keys, YAML keys
    {
      tag: [tags.propertyName, tags.attributeName],
      color: colorProperty,
    },
    // Strings and inserted text
    {
      tag: [tags.string, tags.inserted],
      color: colorString,
    },
    // Numbers, booleans, atoms (null, true, false)
    {
      tag: [tags.number, tags.bool, tags.atom],
      color: colorNumber,
    },
    // Comments
    {
      tag: tags.comment,
      color: colorComment,
      fontStyle: 'italic',
    },
    // Meta / processing instructions (YAML ---, JSON schema refs)
    {
      tag: [tags.meta, tags.processingInstruction],
      color: colorMeta,
    },
    // Operators and punctuation (colons, brackets, commas)
    {
      tag: [tags.operator, tags.punctuation, tags.separator],
      color: colorOperator,
    },
    // Strong / emphasis in Markdown
    {
      tag: tags.strong,
      fontWeight: 'bold',
    },
    {
      tag: tags.emphasis,
      fontStyle: 'italic',
    },
    // Code spans / fences
    {
      tag: tags.monospace,
      fontFamily: 'monospace',
    },
    // Links
    {
      tag: tags.link,
      color: colorString,
      textDecoration: 'underline',
    },
    // Strikethrough
    {
      tag: tags.strikethrough,
      textDecoration: 'line-through',
    },
  ])

  return syntaxHighlighting(style)
}
