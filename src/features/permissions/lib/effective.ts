/**
 * Effective-policy merge — combine the global profile's rules with a project's
 * own rules into the single policy Claude Code actually applies.
 *
 * Pure logic (node:test friendly). Rules:
 *  - `deny` from either scope always wins (it's the hard wall),
 *  - otherwise the project's column overrides the global one for the same rule,
 *  - additional directories are unioned; the project's mode takes precedence.
 */

import type {
  PermissionColumn,
  PermissionMode,
  PermissionRules,
} from '@/shared/types/config'

const COLUMNS: PermissionColumn[] = ['allow', 'ask', 'deny']

/** The column a rule sits in within a single rule set, or null if absent. */
function columnOf(rules: PermissionRules, rule: string): PermissionColumn | null {
  for (const col of COLUMNS) {
    if (rules[col].some((r) => r.trim() === rule)) return col
  }
  return null
}

/** Merges global + project rules into the effective policy. */
export function mergeEffective(
  global: PermissionRules,
  project: PermissionRules,
): PermissionRules {
  const result: PermissionRules = { allow: [], ask: [], deny: [] }

  const all = new Set<string>()
  for (const col of COLUMNS) {
    for (const r of global[col]) all.add(r.trim())
    for (const r of project[col]) all.add(r.trim())
  }

  for (const rule of all) {
    if (!rule) continue
    const g = columnOf(global, rule)
    const p = columnOf(project, rule)
    // deny is supreme; otherwise the project overrides the global column.
    const winner: PermissionColumn =
      g === 'deny' || p === 'deny' ? 'deny' : (p ?? g ?? 'allow')
    result[winner].push(rule)
  }

  const mode: PermissionMode | undefined =
    project.defaultMode && project.defaultMode !== 'default'
      ? project.defaultMode
      : global.defaultMode
  if (mode) result.defaultMode = mode

  const dirs = Array.from(
    new Set([
      ...(global.additionalDirectories ?? []),
      ...(project.additionalDirectories ?? []),
    ]),
  )
  if (dirs.length) result.additionalDirectories = dirs

  return result
}
