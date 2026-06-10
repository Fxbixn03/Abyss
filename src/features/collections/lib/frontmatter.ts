/**
 * Renderer-side YAML frontmatter round-tripping for the collection editor. The
 * main process has its own reader in `core/frontmatter.ts` (it can't be imported
 * here — the renderer tsconfig only exposes `@/*`), so this keeps a compatible
 * parser plus a small serializer used to write the structured form back into the
 * file's frontmatter while preserving the body and any unknown keys.
 */

export type Frontmatter = Record<string, string>

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
    if (line.trim() === '' || /^\s/.test(line)) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (!key) continue
    let value = line.slice(idx + 1).trim()

    if (BLOCK_SCALAR.test(value)) {
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

/** Keys we emit first, in this order, so generated frontmatter stays tidy. */
const KEY_ORDER = [
  'name',
  'description',
  'argument-hint',
  'allowed-tools',
  'tools',
  'model',
  'globs',
  'alwaysApply',
]

function needsQuoting(value: string): boolean {
  return (
    value !== value.trim() ||
    /[:#]/.test(value) ||
    /^[>|*&!%@`'"[\]{},]/.test(value)
  )
}

function emit(key: string, value: string): string {
  const v = needsQuoting(value)
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : value
  return `${key}: ${v}`
}

/**
 * Serialize frontmatter + body back into a file. Empty values are dropped, known
 * keys lead, and any other keys are preserved in their original order. When no
 * keys remain, the body is returned without a frontmatter block.
 */
export function serializeFrontmatter(data: Frontmatter, body: string): string {
  const keys = [
    ...KEY_ORDER.filter((k) => k in data),
    ...Object.keys(data).filter((k) => !KEY_ORDER.includes(k)),
  ]
  const lines = keys
    .filter((k) => (data[k] ?? '').trim() !== '')
    .map((k) => emit(k, data[k].trim()))

  const trimmedBody = body.replace(/^\n+/, '')
  if (lines.length === 0) return trimmedBody
  return `---\n${lines.join('\n')}\n---\n\n${trimmedBody}`
}
