/**
 * Rule activation simulator — Cursor's `.mdc` scoped-rules model made visible.
 *
 * Cursor rules attach to context in four ways: `alwaysApply` (every request),
 * `globs` (auto-attached when an edited/referenced file matches), a bare
 * `description` (the agent decides, by relevance), or nothing (manual `@rule`
 * only). Given a file path, this answers the question the editor can't show on
 * its own: *for this file, which rules actually fire — and what do they cost?*
 *
 * Pure: no React, no Node, no IPC, so it stays unit-testable. The page gathers
 * rule frontmatter and a path and calls {@link simulateActivation}.
 */

import { estimateTokens } from '@/features/context/lib/tokens'

/** How a rule enters context for a given file. */
export type Activation =
  | 'always' // alwaysApply: true — in every request
  | 'auto' // globs matched this path — auto-attached
  | 'agent' // description-only — the agent attaches it by relevance
  | 'inactive' // has globs, but none match this path
  | 'manual' // no trigger — only via an explicit @rule mention

/** A rule as read from disk (frontmatter + body). */
export interface RuleInput {
  id: string
  name: string
  /** Raw `globs` frontmatter value (comma-separated, braces allowed). */
  globs?: string
  alwaysApply?: boolean
  description?: string
  /** Rule body (drives the token cost when loaded). */
  content: string
}

export interface RuleActivation {
  id: string
  name: string
  activation: Activation
  /** Declared globs, normalised into a list. */
  globs: string[]
  /** Globs that matched the path (subset of `globs`, only for `auto`). */
  matchedGlobs: string[]
  /** Estimated tokens the rule body costs when it is loaded. */
  tokens: number
  /** Whether this rule is loaded into context for the given path. */
  active: boolean
  /** One-line explanation of the classification. */
  reason: string
}

export interface SimulationResult {
  path: string
  rules: RuleActivation[]
  /** Count of rules loaded for this path (always + matched auto). */
  activeCount: number
  /** Total tokens loaded into context for this path. */
  activeTokens: number
}

/** Normalise a path for matching: strip `./`, backslashes → `/`, no leading `/`. */
export function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

/**
 * Split a `globs` frontmatter value into individual patterns. Commas separate
 * patterns, but a comma inside a `{a,b}` brace group does not — so we track
 * brace depth instead of a naive `split(',')`. Surrounding `[ ]` (YAML flow
 * list) and quotes are stripped.
 */
export function splitGlobs(globs: string | undefined): string[] {
  if (!globs) return []
  let s = globs.trim()
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '{') depth++
    else if (ch === '}') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
    .map((g) => g.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean)
}

/** Compile a Cursor-style glob (`**`, `*`, `?`, `{a,b}`) into an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` collapses to "any path incl. none", so `**/x` matches `x` too.
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else {
        re += '[^/]*'
      }
      continue
    }
    if (c === '?') {
      re += '[^/]'
      continue
    }
    if (c === '{') {
      re += '(?:'
      continue
    }
    if (c === '}') {
      re += ')'
      continue
    }
    if (c === ',') {
      re += '|'
      continue
    }
    if ('.+^$()|[]\\/'.includes(c)) {
      re += `\\${c}`
      continue
    }
    re += c
  }
  return new RegExp(`^${re}$`)
}

/**
 * True when `path` matches `glob`. A glob without a `/` also matches against the
 * basename, so `*.ts` matches `src/app.ts` the way users expect.
 */
export function pathMatchesGlob(path: string, glob: string): boolean {
  const g = normalizePath(glob)
  let re: RegExp
  try {
    re = globToRegExp(g)
  } catch {
    return false
  }
  if (re.test(path)) return true
  if (!g.includes('/')) {
    const base = path.split('/').pop() ?? path
    return re.test(base)
  }
  return false
}

/** Classify one rule against a (already-normalised) path. */
function classify(
  rule: RuleInput,
  path: string,
): { activation: Activation; matched: string[]; reason: string } {
  const globs = splitGlobs(rule.globs)

  if (rule.alwaysApply) {
    return {
      activation: 'always',
      matched: [],
      reason: 'alwaysApply — loaded into every request.',
    }
  }

  if (globs.length > 0) {
    const matched = path ? globs.filter((g) => pathMatchesGlob(path, g)) : []
    if (matched.length > 0) {
      return {
        activation: 'auto',
        matched,
        reason: `Auto-attached: path matches ${matched.join(', ')}.`,
      }
    }
    if (rule.description?.trim()) {
      return {
        activation: 'agent',
        matched: [],
        reason:
          'Globs don’t match this path, but the agent may still attach it by description.',
      }
    }
    return {
      activation: 'inactive',
      matched: [],
      reason: path
        ? 'Has globs, but none match this path.'
        : 'Has globs — enter a path to test them.',
    }
  }

  if (rule.description?.trim()) {
    return {
      activation: 'agent',
      matched: [],
      reason: 'Agent-requested: attached by relevance to its description.',
    }
  }

  return {
    activation: 'manual',
    matched: [],
    reason: 'No trigger — only loads via an explicit @rule mention.',
  }
}

/**
 * Simulate which rules activate for `rawPath`. `always` and matched `auto` rules
 * are counted as loaded (full body in context); the rest sit out for this path.
 */
export function simulateActivation(
  rules: RuleInput[],
  rawPath: string,
): SimulationResult {
  const path = normalizePath(rawPath)

  const evaluated: RuleActivation[] = rules.map((rule) => {
    const { activation, matched, reason } = classify(rule, path)
    const active = activation === 'always' || activation === 'auto'
    return {
      id: rule.id,
      name: rule.name,
      activation,
      globs: splitGlobs(rule.globs),
      matchedGlobs: matched,
      tokens: estimateTokens(rule.content),
      active,
      reason,
    }
  })

  const activeTokens = evaluated
    .filter((r) => r.active)
    .reduce((n, r) => n + r.tokens, 0)

  return {
    path,
    rules: evaluated,
    activeCount: evaluated.filter((r) => r.active).length,
    activeTokens,
  }
}
