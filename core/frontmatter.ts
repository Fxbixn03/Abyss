/**
 * Minimal YAML frontmatter reader — enough to surface `name`, `description`,
 * `model`, `tools` for collection listings without pulling in a YAML dep. Only
 * single-line `key: value` pairs are parsed (which is all these files use).
 */

export type Frontmatter = Record<string, string>

export function parseFrontmatter(content: string): {
  data: Frontmatter
  body: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!match) return { data: {}, body: content }

  const data: Frontmatter = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) data[key] = value
  }
  return { data, body: match[2] }
}
