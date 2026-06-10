/**
 * Markdown heading outline for the instruction editor. Pure (no React/Node) so
 * it is unit-testable. Headings inside fenced code blocks are ignored so a
 * `# comment` in an example doesn't pollute the table of contents.
 */

export interface OutlineItem {
  /** Heading depth, 1–6. */
  level: number
  text: string
  /** 1-based line number, used to jump the editor to the heading. */
  line: number
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^\s*(```|~~~)/

export function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = []
  let inFence = false
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = HEADING_RE.exec(line)
    if (match) {
      items.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      })
    }
  }
  return items
}
