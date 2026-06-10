/**
 * Permission simulator — evaluate a concrete tool call against a rule set and
 * report which decision (allow / ask / deny) Claude Code would reach and which
 * rule produced it.
 *
 * Pure logic (node:test friendly). Matching mirrors Claude Code's semantics:
 *  - bare tool rules (`Bash`) match every call of that tool,
 *  - Bash specifiers are command prefixes (`Bash(git push:*)`),
 *  - path tools use globs (`Read(./.env)`),
 *  - MCP rules match the server/tool id (with `*` and server-level wildcards).
 * Precedence is deny > ask > allow; an unmatched call defaults to `ask`.
 */

import type { PermissionRules } from '@/shared/types/config'
import { globToRegExp, parseRule, PATH_TOOLS } from './glob'

export type Decision = keyof PermissionRules

export interface EvalResult {
  decision: Decision
  /** The rule that decided the outcome, or null when nothing matched. */
  matchedRule: string | null
  /** The column the matched rule lives in, or null when nothing matched. */
  column: Decision | null
  /** True when no rule matched and the default (`ask`) was applied. */
  defaulted: boolean
}

/** Order rules are evaluated in — first match wins, deny before ask before allow. */
const PRECEDENCE: Decision[] = ['deny', 'ask', 'allow']

interface Call {
  tool: string
  /** The call argument (command for Bash, path for file tools), or null. */
  arg: string | null
}

/** Parses a tool call like `Bash(rm -rf /)` or `Read(./.env)` into parts. */
export function parseCall(toolCall: string): Call | null {
  const trimmed = toolCall.trim()
  if (!trimmed) return null
  const { tool, specifier } = parseRule(trimmed)
  if (!tool) return null
  return { tool, arg: specifier }
}

function stripDotSlash(p: string): string {
  return p.replace(/^\.\//, '')
}

/** Whether a single rule matches a parsed call. */
function ruleMatches(rule: string, call: Call): boolean {
  const r = parseRule(rule)

  // MCP rules: match the server/tool id, with `*` and server-level wildcards.
  if (r.tool.startsWith('mcp__')) {
    if (r.tool.endsWith('*')) return call.tool.startsWith(r.tool.slice(0, -1))
    return call.tool === r.tool || call.tool.startsWith(`${r.tool}__`)
  }

  if (r.tool !== call.tool) return false
  // Bare tool rule matches every call of that tool.
  if (r.specifier === null) return true
  // Rule needs a specifier but the call has none.
  if (call.arg === null) return false

  if (call.tool === 'Bash') {
    const spec = r.specifier.trim()
    const cmd = call.arg.trim()
    if (spec.endsWith(':*')) {
      const prefix = spec.slice(0, -2).trim()
      return cmd === prefix || cmd.startsWith(prefix)
    }
    return cmd === spec
  }

  if (PATH_TOOLS.has(call.tool)) {
    try {
      return globToRegExp(stripDotSlash(r.specifier)).test(stripDotSlash(call.arg))
    } catch {
      return false
    }
  }

  return r.specifier.trim() === call.arg.trim()
}

/** Evaluates a tool call against the rules, returning the winning decision. */
export function evaluate(rules: PermissionRules, toolCall: string): EvalResult {
  const call = parseCall(toolCall)
  if (call) {
    for (const column of PRECEDENCE) {
      for (const rule of rules[column]) {
        if (ruleMatches(rule, call)) {
          return { decision: column, matchedRule: rule, column, defaulted: false }
        }
      }
    }
  }
  // Nothing matched (or unparseable) — Claude Code falls back to asking.
  return { decision: 'ask', matchedRule: null, column: null, defaulted: true }
}
