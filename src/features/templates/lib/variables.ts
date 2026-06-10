/**
 * `{{placeholder}}` support for prompt templates. Pure (no React, no Node) so it
 * can be unit-tested and reused by the editor, the apply dialog and copy.
 *
 * A variable is `{{ name }}` where name is letters, digits, `_`, `-` or `.`.
 * Whitespace inside the braces is ignored, so `{{args}}` and `{{ args }}` are
 * the same variable. This mirrors the Gemini command `{{args}}` convention.
 */

const VARIABLE_RE = /\{\{\s*([\w.-]+)\s*\}\}/g

/** Unique variable names in the order they first appear in the content. */
export function extractVariables(content: string): string[] {
  const seen = new Set<string>()
  for (const match of content.matchAll(VARIABLE_RE)) {
    seen.add(match[1])
  }
  return [...seen]
}

/** True if the content contains at least one `{{placeholder}}`. */
export function hasVariables(content: string): boolean {
  VARIABLE_RE.lastIndex = 0
  return VARIABLE_RE.test(content)
}

/**
 * Replace every `{{name}}` with its value. Unknown names (no entry, or an empty
 * string) are left as-is so a half-filled template still reads sensibly and the
 * user can see what is still missing.
 */
export function applyVariables(
  content: string,
  values: Record<string, string>,
): string {
  return content.replace(VARIABLE_RE, (whole, name: string) => {
    const value = values[name]
    return value && value.length > 0 ? value : whole
  })
}
