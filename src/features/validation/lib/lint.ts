/**
 * "Linting for agent systems" — static checks over an agent's on-disk config.
 * Like a compiler/ESLint pass but for AI setups: it surfaces unused skills,
 * dangerous permissions, oversized context, broken MCP/hook wiring and
 * conflicting instructions so a growing config doesn't rot into a YAML swamp.
 */

import type { PermissionRules } from '@/shared/types/config'
import { detectInstructionConflicts } from '@/features/context/lib/conflicts'
import { formatTokens } from '@/features/context/lib/tokens'

export type LintSeverity = 'error' | 'warning' | 'info'

export interface LintFinding {
  id: string
  severity: LintSeverity
  category: string
  title: string
  detail: string
}

export interface LintCollectionItem {
  id: string
  name: string
  content: string
}

export interface LintInput {
  instructions: string
  agents: LintCollectionItem[]
  skills: LintCollectionItem[]
  commands: LintCollectionItem[]
  mcp: { name: string; command?: string; url?: string; enabled: boolean }[]
  hooks: { event: string; matcher: string; command: string }[]
  permissions: PermissionRules
  totalTokens: number
}

const TOKEN_WARN = 40000
const TOKEN_ERROR = 100000

/** Tools that are dangerous when allowed without a specifier. */
const RISKY_UNRESTRICTED = new Set(['Bash', 'Write', 'Edit', 'MultiEdit'])

export function runLint(input: LintInput): LintFinding[] {
  const findings: LintFinding[] = []
  const add = (f: LintFinding): void => {
    findings.push(f)
  }

  // --- Permissions ----------------------------------------------------------
  const { allow, deny } = input.permissions
  const unrestricted = allow.filter((r) => RISKY_UNRESTRICTED.has(r.trim()))
  for (const tool of unrestricted) {
    add({
      id: `perm-unrestricted-${tool}`,
      severity: 'warning',
      category: 'Permissions',
      title: `${tool} is allowed without restriction`,
      detail: `Every ${tool} call runs without approval. Scope it with a specifier, e.g. ${tool}(safe-pattern).`,
    })
  }
  if (unrestricted.length >= 2 && deny.length === 0) {
    add({
      id: 'perm-no-guardrails',
      severity: 'error',
      category: 'Permissions',
      title: 'No guardrails — broad access with an empty Deny list',
      detail:
        'Multiple powerful tools run freely and nothing is denied. Add Deny rules for secrets and destructive commands.',
    })
  }
  const denText = deny.join(' ').toLowerCase()
  if (!denText.includes('.env') && !denText.includes('secret')) {
    add({
      id: 'perm-secrets',
      severity: 'info',
      category: 'Permissions',
      title: 'Secrets are not explicitly denied',
      detail: 'Consider denying Read(./.env) and similar to keep credentials out of context.',
    })
  }

  // --- Context size ---------------------------------------------------------
  if (input.totalTokens >= TOKEN_ERROR) {
    add({
      id: 'ctx-huge',
      severity: 'error',
      category: 'Context',
      title: `Base context is very large (~${formatTokens(input.totalTokens)} tokens)`,
      detail: 'High truncation risk before the conversation even starts. Trim instructions or move detail into on-demand skills.',
    })
  } else if (input.totalTokens >= TOKEN_WARN) {
    add({
      id: 'ctx-large',
      severity: 'warning',
      category: 'Context',
      title: `Base context is large (~${formatTokens(input.totalTokens)} tokens)`,
      detail: 'Smaller models may truncate. Keep an eye on total context.',
    })
  }

  // --- Instructions ---------------------------------------------------------
  if (!input.instructions.trim()) {
    add({
      id: 'instr-empty',
      severity: 'info',
      category: 'Instructions',
      title: 'No instructions defined',
      detail: 'The agent runs with only its base prompt. Add an instruction file to steer it.',
    })
  }

  // --- Unused skills / subagents -------------------------------------------
  // A skill/agent is "unused" if its name isn't mentioned anywhere else.
  const corpus = [
    input.instructions,
    ...input.agents.map((a) => a.content),
    ...input.skills.map((s) => s.content),
    ...input.commands.map((c) => c.content),
  ]
    .join('\n')
    .toLowerCase()
  const checkUnused = (
    items: LintCollectionItem[],
    kind: string,
    selfContent: (id: string) => string,
  ): void => {
    for (const item of items) {
      const needle = item.name.toLowerCase()
      if (needle.length < 3) continue
      // Count mentions outside the item's own file.
      const own = selfContent(item.id).toLowerCase()
      const outside = corpus
        .split(own)
        .join(' ')
        .includes(needle)
      if (!outside) {
        add({
          id: `unused-${kind}-${item.id}`,
          severity: 'info',
          category: kind === 'skill' ? 'Skills' : 'Subagents',
          title: `${kind === 'skill' ? 'Skill' : 'Subagent'} “${item.name}” is never referenced`,
          detail: `Nothing else mentions “${item.name}”. It may be dead config — or loaded implicitly by description.`,
        })
      }
    }
  }
  const skillContent = new Map(input.skills.map((s) => [s.id, s.content]))
  const agentContent = new Map(input.agents.map((a) => [a.id, a.content]))
  checkUnused(input.skills, 'skill', (id) => skillContent.get(id) ?? '')
  checkUnused(input.agents, 'agent', (id) => agentContent.get(id) ?? '')

  // --- MCP ------------------------------------------------------------------
  const mcpNames = new Map<string, number>()
  for (const s of input.mcp) {
    mcpNames.set(s.name, (mcpNames.get(s.name) ?? 0) + 1)
    if (!s.command && !s.url) {
      add({
        id: `mcp-empty-${s.name}`,
        severity: 'error',
        category: 'MCP',
        title: `MCP server “${s.name}” has no command or URL`,
        detail: 'It can never start. Set a stdio command or an http/sse URL.',
      })
    }
  }
  for (const [name, count] of mcpNames) {
    if (count > 1) {
      add({
        id: `mcp-dup-${name}`,
        severity: 'warning',
        category: 'MCP',
        title: `Duplicate MCP server name “${name}”`,
        detail: `Defined ${count} times — the last one wins on disk.`,
      })
    }
  }

  // --- Hooks ----------------------------------------------------------------
  for (const h of input.hooks) {
    if (!h.command.trim()) {
      add({
        id: `hook-empty-${h.event}-${h.matcher}`,
        severity: 'warning',
        category: 'Hooks',
        title: `Hook on ${h.event} has an empty command`,
        detail: 'It does nothing. Add a command or remove the hook.',
      })
    }
  }

  // --- Conflicts (reuse the context detector) -------------------------------
  const conflictSources = [
    { label: 'Instructions', text: input.instructions },
    ...input.agents.map((a) => ({ label: `Subagent: ${a.name}`, text: a.content })),
    ...input.skills.map((s) => ({ label: `Skill: ${s.name}`, text: s.content })),
    ...input.commands.map((c) => ({ label: `Command: ${c.name}`, text: c.content })),
  ]
  for (const c of detectInstructionConflicts(conflictSources)) {
    add({
      id: `conflict-${findings.length}`,
      severity: c.severity,
      category: c.kind === 'contradiction' ? 'Conflicts' : 'Duplication',
      title: c.kind === 'contradiction' ? 'Contradictory instructions' : 'Duplicated instruction',
      detail: `${c.message} (${c.sources.join(', ')})`,
    })
  }

  return findings
}
