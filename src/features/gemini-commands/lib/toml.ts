/**
 * Client-side TOML helpers for the Gemini command editor. `smol-toml` is pure
 * ESM (no Node APIs), so the form <-> raw-TOML conversion runs in the renderer;
 * only the finished text crosses IPC to be written. Re-serializing preserves
 * unknown keys but not comments/formatting — the same trade-off as the Codex
 * subagent editor.
 */

import { parse, stringify } from 'smol-toml'

/** Structured fields surfaced in the form view. */
export interface CommandFields {
  name: string
  description: string
  prompt: string
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Default display name for a command id: `git/commit` → `git:commit`. */
export function defaultName(id: string): string {
  return id.split(/[\\/]+/).filter(Boolean).join(':')
}

/** Parse raw TOML, returning the object plus a human-readable error (or null). */
export function parseToml(raw: string): {
  data: Record<string, unknown>
  error: string | null
} {
  if (!raw.trim()) return { data: {}, error: null }
  try {
    return { data: parse(raw) as Record<string, unknown>, error: null }
  } catch (err) {
    return { data: {}, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Extract the structured form fields from a parsed TOML object. */
export function fieldsFromData(data: Record<string, unknown>): CommandFields {
  return {
    name: asString(data.name),
    description: asString(data.description),
    prompt: asString(data.prompt),
  }
}

/**
 * Set a single field on the raw TOML and return the re-serialized text. The
 * caller must only invoke this on parseable TOML (the form is disabled while the
 * raw text has a syntax error).
 */
export function patchField(
  raw: string,
  key: keyof CommandFields,
  value: string,
): string {
  const { data } = parseToml(raw)
  data[key] = value
  return stringify(data)
}

/** Starter TOML for a brand-new command, with the three core fields. */
export function defaultTemplate(id: string): string {
  return stringify({
    name: defaultName(id),
    description: '',
    prompt: '',
  })
}
