/**
 * Slash-command argument placeholders. Pure (no React/Node) so the "Try
 * command" preview and validation can share the logic. Supports `$ARGUMENTS`
 * (all args) and the positional `$1`–`$9`.
 */

const ARG_RE = /\$ARGUMENTS|\$[1-9](?![0-9])/g

/** Unique placeholders in a stable order: `$ARGUMENTS` first, then `$1`…`$9`. */
export function extractArgs(body: string): string[] {
  const seen = new Set<string>()
  for (const m of body.matchAll(ARG_RE)) seen.add(m[0])
  return [...seen].sort((a, b) =>
    a === '$ARGUMENTS' ? -1 : b === '$ARGUMENTS' ? 1 : a.localeCompare(b),
  )
}

export function hasArgs(body: string): boolean {
  return /\$ARGUMENTS|\$[1-9](?![0-9])/.test(body)
}

/** Replace each placeholder with its value; unfilled ones are left as-is. */
export function applyArgs(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(ARG_RE, (token) => {
    const v = values[token]
    return v && v.length > 0 ? v : token
  })
}
