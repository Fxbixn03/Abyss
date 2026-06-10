/**
 * Pure helpers for turning a template into the next version of an instruction
 * file. Kept free of React/Node so the logic (insert position, de-duplication,
 * composition) is unit-testable and shared by the apply dialog and the palette.
 */

/** Where the template block lands relative to existing content. */
export type InsertMode = 'append' | 'prepend'

/** Collapse runs of whitespace so cosmetic differences don't defeat dedup. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * True if `block` already appears in `existing` (ignoring whitespace runs), so
 * the UI can show "already applied" instead of silently duplicating it.
 */
export function isBlockPresent(existing: string, block: string): boolean {
  const needle = normalize(block)
  if (!needle) return false
  return normalize(existing).includes(needle)
}

/** Compute the new file content with `block` inserted in `mode` position. */
export function insertBlock(
  existing: string,
  block: string,
  mode: InsertMode,
): string {
  const body = block.trim()
  if (!body) return existing
  const trimmed = existing.replace(/^\n+|\n+$/g, '')
  if (!trimmed) return `${body}\n`
  return mode === 'prepend'
    ? `${body}\n\n${trimmed}\n`
    : `${trimmed}\n\n${body}\n`
}

/**
 * Merge several template bodies into one block, separated by a blank line.
 * Empty bodies are dropped; each is trimmed so spacing stays consistent.
 */
export function composeTemplates(contents: string[]): string {
  return contents
    .map((c) => c.trim())
    .filter(Boolean)
    .join('\n\n')
}
