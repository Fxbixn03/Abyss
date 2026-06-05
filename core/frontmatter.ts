/**
 * Minimal YAML frontmatter reader — enough to surface `name`, `description`,
 * `model`, `tools` for collection listings without pulling in a YAML dep.
 *
 * Handles top-level `key: value` pairs plus block scalars (`key: |` / `key: >`),
 * whose indented continuation lines are collapsed to a single space-joined
 * string. Indented lines (block bodies, list items) are not treated as keys.
 */

export type Frontmatter = Record<string, string>

/** A YAML block scalar header: `|`, `>` with optional chomping/indent indicators. */
const BLOCK_SCALAR = /^[|>][+-]?\d*$/

export function parseFrontmatter(content: string): {
  data: Frontmatter
  body: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!match) return { data: {}, body: content }

  const data: Frontmatter = {}
  const lines = match[1].split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Only top-level keys define values; skip blanks and indented (child) lines.
    if (line.trim() === '' || /^\s/.test(line)) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (!key) continue
    let value = line.slice(idx + 1).trim()

    if (BLOCK_SCALAR.test(value)) {
      // Consume the indented (and blank) continuation lines of the block scalar.
      const parts: string[] = []
      while (
        i + 1 < lines.length &&
        (lines[i + 1].trim() === '' || /^\s/.test(lines[i + 1]))
      ) {
        parts.push(lines[++i].trim())
      }
      data[key] = parts.join(' ').replace(/\s+/g, ' ').trim()
      continue
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return { data, body: match[2] }
}
