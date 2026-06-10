/**
 * Cross-column conflict detection and per-rule risk assessment.
 *
 * Pure logic (no React, no Node) so it can be unit-tested with node:test and
 * reused by the editor. A "conflict" is the same rule sitting in more than one
 * column — confusing, because Claude Code applies a fixed precedence
 * (deny > ask > allow) and silently picks a winner. Risk assessment flags
 * Allow rules that effectively open the door too wide.
 */

import type { PermissionRules } from '@/shared/types/config'
import { parseRule } from './glob'

export type PermissionCategory = keyof PermissionRules

/** Precedence Claude Code applies when a call matches several columns. */
const PRECEDENCE: PermissionCategory[] = ['deny', 'ask', 'allow']
const COLUMNS: PermissionCategory[] = ['allow', 'ask', 'deny']

export interface RuleConflict {
  /** The duplicated rule (trimmed). */
  rule: string
  /** Columns the rule appears in, in display order. */
  columns: PermissionCategory[]
  /** The column whose decision actually applies. */
  winner: PermissionCategory
}

/** Finds rules that appear (verbatim) in more than one column. */
export function findConflicts(rules: PermissionRules): RuleConflict[] {
  const seen = new Map<string, Set<PermissionCategory>>()
  for (const col of COLUMNS) {
    for (const raw of rules[col]) {
      const key = raw.trim()
      if (!key) continue
      const set = seen.get(key) ?? new Set<PermissionCategory>()
      set.add(col)
      seen.set(key, set)
    }
  }

  const conflicts: RuleConflict[] = []
  for (const [rule, cols] of seen) {
    if (cols.size < 2) continue
    conflicts.push({
      rule,
      columns: COLUMNS.filter((c) => cols.has(c)),
      winner: PRECEDENCE.find((c) => cols.has(c)) as PermissionCategory,
    })
  }
  return conflicts
}

/** Conflicts keyed by trimmed rule, for O(1) lookup while rendering a column. */
export function buildConflictMap(
  rules: PermissionRules,
): Map<string, RuleConflict> {
  return new Map(findConflicts(rules).map((c) => [c.rule, c]))
}

export type RiskLevel = 'none' | 'warn' | 'high'

export interface RiskAssessment {
  level: RiskLevel
  /** Why the rule is risky (empty when level is 'none'). */
  reason: string
}

const NO_RISK: RiskAssessment = { level: 'none', reason: '' }

/** Powerful tools that, allowed bare, run with no restriction at all. */
const BARE_RISKY_TOOLS = new Set([
  'Bash',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
])

/** Bash command prefixes that can do real damage. */
const DANGEROUS_BASH = new Set([
  'rm',
  'sudo',
  'chmod',
  'curl',
  'wget',
  'mkfs',
  'dd',
  'eval',
])

/**
 * Rates how risky a rule is — only meaningful for the Allow column, where a
 * too-broad rule silently widens what the agent may do. Deny/ask are expected
 * to be broad, so they're never flagged.
 */
export function assessRisk(
  rule: string,
  category: PermissionCategory,
): RiskAssessment {
  if (category !== 'allow') return NO_RISK

  const { tool, specifier } = parseRule(rule)

  // A bare powerful tool: every call of it runs without asking.
  if (specifier === null) {
    return BARE_RISKY_TOOLS.has(tool)
      ? {
          level: 'high',
          reason: `Allows every ${tool} call without restriction.`,
        }
      : NO_RISK
  }

  const spec = specifier.trim()

  // Catch-all specifiers that match practically everything.
  if (spec === '*' || spec === '**' || spec === ':*') {
    return {
      level: 'warn',
      reason: 'Very broad pattern — matches almost everything.',
    }
  }

  // Dangerous shell commands allowed without a prompt.
  if (tool === 'Bash') {
    const prefix = spec.replace(/:\*$/, '').trim()
    const head = prefix.split(/\s+/)[0]
    if (DANGEROUS_BASH.has(head)) {
      return {
        level: 'high',
        reason: `Allows the dangerous command “${head}” without asking.`,
      }
    }
  }

  return NO_RISK
}
