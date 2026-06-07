/**
 * Client-side TOML helpers for the Codex subagent editor. `smol-toml` is pure
 * ESM (no Node APIs), so the form <-> raw-TOML conversion runs in the renderer;
 * only the finished text crosses IPC to be written. Re-serializing preserves
 * unknown keys (mcp_servers, skills, …) but not comments/formatting — the same
 * trade-off as `core/mcp-codex.ts`.
 */

import { parse, stringify } from 'smol-toml'
import type { CodexSandboxMode } from '@/shared/types/config'

/** Structured fields surfaced in the form view. */
export interface SubagentFields {
  name: string
  description: string
  developer_instructions: string
  model: string
  model_reasoning_effort: string
  sandbox_mode: string
  nickname_candidates: string[]
}

/** Optional keys that are dropped from the TOML when left empty (→ inherited). */
const OPTIONAL_KEYS = new Set([
  'model',
  'model_reasoning_effort',
  'sandbox_mode',
  'nickname_candidates',
])

export const REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
] as const

export const SANDBOX_MODES: CodexSandboxMode[] = [
  'read-only',
  'workspace-write',
  'danger-full-access',
]

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
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
export function fieldsFromData(data: Record<string, unknown>): SubagentFields {
  return {
    name: asString(data.name),
    description: asString(data.description),
    developer_instructions: asString(data.developer_instructions),
    model: asString(data.model),
    model_reasoning_effort: asString(data.model_reasoning_effort),
    sandbox_mode: asString(data.sandbox_mode),
    nickname_candidates: asStringArray(data.nickname_candidates),
  }
}

/**
 * Set a single field on the raw TOML and return the re-serialized text. Optional
 * keys are removed when empty so Codex inherits them from the parent session.
 * The caller must only invoke this on parseable TOML (the form is disabled while
 * the raw text has a syntax error).
 */
export function patchField(
  raw: string,
  key: keyof SubagentFields,
  value: string | string[],
): string {
  const { data } = parseToml(raw)
  const isEmpty = Array.isArray(value) ? value.length === 0 : value === ''
  if (OPTIONAL_KEYS.has(key) && isEmpty) {
    delete data[key]
  } else {
    data[key] = value
  }
  return stringify(data)
}

/** Starter TOML for a brand-new subagent, with the three required fields. */
export function defaultTemplate(id: string): string {
  return stringify({
    name: id,
    description: '',
    developer_instructions: '',
  })
}
