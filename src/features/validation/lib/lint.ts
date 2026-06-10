/**
 * "Linting for agent systems" — static checks over an agent's on-disk config.
 * Like a compiler/ESLint pass but for AI setups: it surfaces unused subagents,
 * dangerous permissions, oversized context, broken MCP/hook wiring, malformed
 * frontmatter and conflicting instructions so a growing config doesn't rot.
 *
 * Pure: no React, no Node, no IPC — the page gathers data and calls {@link
 * runLint}, which keeps the logic unit-testable.
 */

import type { CollectionKind } from '@/shared/types/collections'
import type { PermissionRules } from '@/shared/types/config'
import { detectInstructionConflicts } from '@/features/context/lib/conflicts'
import { formatTokens, estimateTokens } from '@/features/context/lib/tokens'
import { KNOWN_TOOLS, parseToolList } from '@/features/collections/lib/tools'
import { SANDBOX_MODES, REASONING_EFFORTS } from '@/features/subagents/lib/toml'

export type LintSeverity = 'error' | 'warning' | 'info'

/** Where a finding can be opened/fixed: a route, optionally a collection item. */
export interface LintOpen {
  route: string
  collectionKind?: CollectionKind
  itemId?: string
}

export interface LintFinding {
  id: string
  severity: LintSeverity
  category: string
  title: string
  detail: string
  /** Source item id, when the finding is about one collection item. */
  itemId?: string
  /** Absolute file path, for a "Reveal in folder" action. */
  path?: string
  /** 1-based line, when known. */
  line?: number
  /** Jump target for a "Open" action. */
  open?: LintOpen
}

/** One instruction file (an agent can expose several). */
export interface LintInstruction {
  specId: string
  filename: string
  /** 'global' | 'project' — for scope-aware (merged) validation. */
  scope: string
  content: string
  path?: string
}

/** A markdown collection item, frontmatter intact (no longer reduced to text). */
export interface LintItem {
  kind: 'agent' | 'skill' | 'command' | 'rule'
  id: string
  name: string
  content: string
  description?: string
  model?: string
  /** Subagent `tools` or command `allowed-tools`. */
  tools?: string
  globs?: string
  alwaysApply?: boolean
  path?: string
}

/** A Codex TOML subagent (different shape + enums to validate). */
export interface LintCodexSubagent {
  id: string
  name: string
  description: string
  model?: string
  sandboxMode?: string
  reasoning?: string
  /** Required TOML fields that are missing. */
  missing: string[]
  /** TOML parse error, or null. */
  parseError: string | null
  path?: string
}

export interface LintMcpServer {
  name: string
  command?: string
  url?: string
  enabled: boolean
}

export interface LintRawSettings {
  file: string
  content: string
  path?: string
}

/** Something that couldn't be read, surfaced instead of swallowed. */
export interface LintReadError {
  label: string
  detail: string
}

export interface LintInput {
  agentId: string
  instructions: LintInstruction[]
  agents: LintItem[]
  skills: LintItem[]
  commands: LintItem[]
  rules: LintItem[]
  codexSubagents: LintCodexSubagent[]
  mcp: LintMcpServer[]
  hooks: { event: string; matcher: string; command: string }[]
  permissions: PermissionRules
  rawSettings: LintRawSettings[]
  readErrors: LintReadError[]
}

const TOKEN_WARN = 40000
const TOKEN_ERROR = 100000
const BASE_PROMPT_TOKENS = 2500
const MCP_SCHEMA_TOKENS = 250

/** Model aliases accepted as-is; full ids (with a hyphen+digit or slash) too. */
const MODEL_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'inherit', 'default'])

function isKnownModel(model: string): boolean {
  const v = model.trim().toLowerCase()
  if (!v) return true
  if (MODEL_ALIASES.has(v)) return true
  // Looks like a real model id, e.g. claude-opus-4-…, gpt-4o, provider/model.
  return /[a-z].*-.*\d/.test(v) || v.includes('/')
}

/** Tools considered dangerous when allowed without a specifier, per agent. */
function riskyTools(_agentId: string): Set<string> {
  return new Set([
    'Bash',
    'Write',
    'Edit',
    'MultiEdit',
    'WebFetch',
    'NotebookEdit',
  ])
}

/** Strip a permission specifier: `Bash(git diff:*)` → `Bash`. */
function baseTool(rule: string): string {
  return rule.split('(')[0].trim()
}

/** Tokens that are always in context: instructions + always-on rules. */
function alwaysOnTokens(input: LintInput): number {
  const instr = input.instructions.reduce(
    (n, i) => n + estimateTokens(i.content),
    0,
  )
  const rules = input.rules.reduce(
    (n, r) =>
      n + estimateTokens(r.alwaysApply ? r.content : (r.description ?? '')),
    0,
  )
  return instr + rules
}

/**
 * On-demand context: skills/commands/subagents load when invoked, so only their
 * always-listed metadata (the description) sits in the base context, not the
 * whole body. This stops "context too large" from being wildly inflated.
 */
function onDemandTokens(input: LintInput): number {
  const items = [...input.skills, ...input.commands, ...input.agents]
  return items.reduce((n, i) => n + estimateTokens(i.description ?? ''), 0)
}

export function estimateBaseTokens(input: LintInput): number {
  const mcp = input.mcp.filter((s) => s.enabled).length * MCP_SCHEMA_TOKENS
  return (
    BASE_PROMPT_TOKENS + alwaysOnTokens(input) + onDemandTokens(input) + mcp
  )
}

/** True if `name` appears as a whole word anywhere in `corpus`. */
function mentions(corpus: string, name: string): boolean {
  if (name.length < 3) return false
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i').test(corpus)
}

/** Opening `---` without a matching close — a frontmatter the parser dropped. */
function hasUnterminatedFrontmatter(content: string): boolean {
  const t = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  if (!t.startsWith('---')) return false
  return !/^---\r?\n[\s\S]*?\r?\n---/.test(t)
}

export function runLint(input: LintInput): LintFinding[] {
  const findings: LintFinding[] = []
  const add = (f: LintFinding): void => {
    findings.push(f)
  }

  // --- Read errors (surfaced, not swallowed) --------------------------------
  for (const [i, e] of input.readErrors.entries()) {
    add({
      id: `read-error-${i}`,
      severity: 'error',
      category: 'IO',
      title: `Could not read ${e.label}`,
      detail: e.detail,
    })
  }

  // --- Permissions ----------------------------------------------------------
  const { allow, deny } = input.permissions
  const risky = riskyTools(input.agentId)
  const unrestricted = allow.filter((r) => risky.has(r.trim()))
  for (const tool of unrestricted) {
    add({
      id: `perm-unrestricted-${tool}`,
      severity: 'warning',
      category: 'Permissions',
      title: `${tool} is allowed without restriction`,
      detail: `Every ${tool} call runs without approval. Scope it with a specifier, e.g. ${tool}(safe-pattern).`,
      open: { route: '/permissions' },
    })
  }
  // Broad MCP access via a wildcard allow rule.
  const mcpWildcards = allow.filter((r) => /^mcp__.*(\*|__\*|$)/.test(r.trim()))
  for (const rule of mcpWildcards) {
    if (/\*/.test(rule) || /^mcp__[^(]+$/.test(rule.trim())) {
      add({
        id: `perm-mcp-wildcard-${rule}`,
        severity: 'warning',
        category: 'Permissions',
        title: `Broad MCP access allowed (${rule.trim()})`,
        detail:
          'A wildcard MCP allow grants every tool on that server without approval. Scope it to the tools you actually use.',
        open: { route: '/permissions' },
      })
    }
  }
  if (unrestricted.length >= 2 && deny.length === 0) {
    add({
      id: 'perm-no-guardrails',
      severity: 'error',
      category: 'Permissions',
      title: 'No guardrails — broad access with an empty Deny list',
      detail:
        'Multiple powerful tools run freely and nothing is denied. Add Deny rules for secrets and destructive commands.',
      open: { route: '/permissions' },
    })
  }
  const denText = deny.join(' ').toLowerCase()
  if (
    allow.length > 0 &&
    !denText.includes('.env') &&
    !denText.includes('secret')
  ) {
    add({
      id: 'perm-secrets',
      severity: 'info',
      category: 'Permissions',
      title: 'Secrets are not explicitly denied',
      detail:
        'Consider denying Read(./.env) and similar to keep credentials out of context.',
      open: { route: '/permissions' },
    })
  }

  // --- Context size ---------------------------------------------------------
  const totalTokens = estimateBaseTokens(input)
  if (totalTokens >= TOKEN_ERROR) {
    add({
      id: 'ctx-huge',
      severity: 'error',
      category: 'Context',
      title: `Base context is very large (~${formatTokens(totalTokens)} tokens)`,
      detail:
        'High truncation risk before the conversation even starts. Trim instructions or move detail into on-demand skills.',
      open: { route: '/context' },
    })
  } else if (totalTokens >= TOKEN_WARN) {
    add({
      id: 'ctx-large',
      severity: 'warning',
      category: 'Context',
      title: `Base context is large (~${formatTokens(totalTokens)} tokens)`,
      detail: 'Smaller models may truncate. Keep an eye on total context.',
      open: { route: '/context' },
    })
  }

  // --- Instructions ---------------------------------------------------------
  const anyInstructions = input.instructions.some((i) => i.content.trim())
  if (!anyInstructions) {
    add({
      id: 'instr-empty',
      severity: 'info',
      category: 'Instructions',
      title: 'No instructions defined',
      detail:
        'The agent runs with only its base prompt. Add an instruction file to steer it.',
      open: { route: '/config' },
    })
  }
  for (const instr of input.instructions) {
    if (hasUnterminatedFrontmatter(instr.content)) {
      add({
        id: `instr-frontmatter-${instr.scope}-${instr.specId}`,
        severity: 'warning',
        category: 'Instructions',
        title: `Unterminated frontmatter in ${instr.filename}`,
        detail:
          'The file opens with `---` but never closes it, so the frontmatter is ignored.',
        path: instr.path,
        open: { route: '/config' },
      })
    }
  }

  // --- Collection items: description / model / tools / frontmatter ----------
  const checkItem = (item: LintItem): void => {
    const route = `/${item.kind === 'agent' ? 'agents' : item.kind === 'rule' ? 'rules' : `${item.kind}s`}`
    const collectionKind: CollectionKind =
      item.kind === 'agent'
        ? 'agents'
        : item.kind === 'rule'
          ? 'rules'
          : (`${item.kind}s` as CollectionKind)
    const open: LintOpen = { route, collectionKind, itemId: item.id }

    if (hasUnterminatedFrontmatter(item.content)) {
      add({
        id: `fm-broken-${item.kind}-${item.id}`,
        severity: 'error',
        category: 'Frontmatter',
        title: `${item.name}: broken frontmatter`,
        detail:
          'The `---` block is never closed, so name/description/model are ignored.',
        itemId: item.id,
        path: item.path,
        open,
      })
    }

    // Empty description: skills & subagents are picked by description, so an
    // empty one means they effectively never auto-load.
    if (
      (item.kind === 'skill' || item.kind === 'agent') &&
      !item.description?.trim()
    ) {
      add({
        id: `desc-empty-${item.kind}-${item.id}`,
        severity: 'warning',
        category: item.kind === 'skill' ? 'Skills' : 'Subagents',
        title: `${item.name} has no description`,
        detail: `${item.kind === 'skill' ? 'Skills' : 'Subagents'} are selected by their description — without one this never auto-loads.`,
        itemId: item.id,
        path: item.path,
        open,
      })
    }
    if (item.kind === 'command' && !item.description?.trim()) {
      add({
        id: `desc-empty-command-${item.id}`,
        severity: 'info',
        category: 'Commands',
        title: `${item.name} has no description`,
        detail: 'The slash menu and the SlashCommand tool use the description.',
        itemId: item.id,
        path: item.path,
        open,
      })
    }

    if (item.model && !isKnownModel(item.model)) {
      add({
        id: `model-unknown-${item.kind}-${item.id}`,
        severity: 'warning',
        category: 'Model',
        title: `${item.name}: unknown model “${item.model}”`,
        detail:
          'Use an alias (sonnet/opus/haiku/inherit) or a full model id. A typo falls back to the default.',
        itemId: item.id,
        path: item.path,
        open,
      })
    }

    const unknown = parseToolList(item.tools)
      .map(baseTool)
      .filter(
        (t) =>
          t && !KNOWN_TOOLS.includes(t) && !t.startsWith('mcp__') && t !== '*',
      )
    if (unknown.length > 0) {
      add({
        id: `tools-unknown-${item.kind}-${item.id}`,
        severity: 'warning',
        category: 'Tools',
        title: `${item.name}: unrecognized tool${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}`,
        detail:
          'These aren’t known tool names — a typo here silently grants nothing. Check the spelling.',
        itemId: item.id,
        path: item.path,
        open,
      })
    }
  }
  for (const item of [
    ...input.agents,
    ...input.skills,
    ...input.commands,
    ...input.rules,
  ]) {
    checkItem(item)
  }

  // --- Rules without a trigger ----------------------------------------------
  for (const rule of input.rules) {
    if (!rule.alwaysApply && !rule.globs?.trim() && !rule.description?.trim()) {
      add({
        id: `rule-no-trigger-${rule.id}`,
        severity: 'warning',
        category: 'Rules',
        title: `Rule “${rule.name}” never activates`,
        detail:
          'It is not alwaysApply and has no globs or description, so nothing triggers it.',
        itemId: rule.id,
        path: rule.path,
        open: { route: '/rules', collectionKind: 'rules', itemId: rule.id },
      })
    }
  }

  // --- Unused subagents / commands (name-based, word-boundary) --------------
  // Skills are intentionally excluded: they activate by description, never by a
  // name mention, so a name-based check is pure noise for them.
  const corpus = [
    ...input.instructions.map((i) => i.content),
    ...input.agents.map((a) => a.content),
    ...input.skills.map((s) => s.content),
    ...input.commands.map((c) => c.content),
  ].join('\n')
  const checkUnused = (items: LintItem[]): void => {
    for (const item of items) {
      const own = item.content
      const outside = corpus.split(own).join('\n')
      if (!mentions(outside, item.name)) {
        const isAgent = item.kind === 'agent'
        add({
          id: `unused-${item.kind}-${item.id}`,
          severity: 'info',
          category: isAgent ? 'Subagents' : 'Commands',
          title: `${isAgent ? 'Subagent' : 'Command'} “${item.name}” is never referenced by name`,
          detail: isAgent
            ? 'Nothing references it by name. It can still auto-delegate by description, but check it isn’t dead config.'
            : 'Nothing references it. Commands are user-invoked, so this is only a hint.',
          itemId: item.id,
          path: item.path,
          open: {
            route: isAgent ? '/agents' : '/commands',
            collectionKind: isAgent ? 'agents' : 'commands',
            itemId: item.id,
          },
        })
      }
    }
  }
  checkUnused(input.agents)
  checkUnused(input.commands)

  // --- Codex TOML subagents -------------------------------------------------
  for (const sub of input.codexSubagents) {
    if (sub.parseError) {
      add({
        id: `codex-toml-${sub.id}`,
        severity: 'error',
        category: 'Subagents',
        title: `${sub.name}: invalid TOML`,
        detail: sub.parseError,
        itemId: sub.id,
        path: sub.path,
        open: { route: '/agents' },
      })
      continue
    }
    if (sub.missing.length > 0) {
      add({
        id: `codex-missing-${sub.id}`,
        severity: 'error',
        category: 'Subagents',
        title: `${sub.name}: missing required field${sub.missing.length > 1 ? 's' : ''}`,
        detail: `Codex subagents require ${sub.missing.join(', ')}.`,
        itemId: sub.id,
        path: sub.path,
        open: { route: '/agents' },
      })
    }
    if (
      sub.sandboxMode &&
      !(SANDBOX_MODES as readonly string[]).includes(sub.sandboxMode)
    ) {
      add({
        id: `codex-sandbox-${sub.id}`,
        severity: 'warning',
        category: 'Subagents',
        title: `${sub.name}: invalid sandbox_mode “${sub.sandboxMode}”`,
        detail: `Expected one of ${SANDBOX_MODES.join(', ')}.`,
        itemId: sub.id,
        path: sub.path,
        open: { route: '/agents' },
      })
    }
    if (
      sub.reasoning &&
      !(REASONING_EFFORTS as readonly string[]).includes(sub.reasoning)
    ) {
      add({
        id: `codex-reasoning-${sub.id}`,
        severity: 'warning',
        category: 'Subagents',
        title: `${sub.name}: invalid model_reasoning_effort “${sub.reasoning}”`,
        detail: `Expected one of ${REASONING_EFFORTS.join(', ')}.`,
        itemId: sub.id,
        path: sub.path,
        open: { route: '/agents' },
      })
    }
  }

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
        open: { route: '/mcp' },
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
        open: { route: '/mcp' },
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
        open: { route: '/hooks' },
      })
    }
  }

  // --- settings.json validity ----------------------------------------------
  for (const raw of input.rawSettings) {
    if (raw.content.trim() === '') continue
    try {
      JSON.parse(raw.content)
    } catch (err) {
      add({
        id: `settings-json-${raw.file}`,
        severity: 'error',
        category: 'Settings',
        title: `${raw.file} is not valid JSON`,
        detail: err instanceof Error ? err.message : 'Parse error.',
        path: raw.path,
      })
    }
  }

  // --- Conflicts (reuse the context detector) -------------------------------
  const conflictSources = [
    ...input.instructions.map((i) => ({
      label: `Instructions (${i.scope}): ${i.filename}`,
      text: i.content,
    })),
    ...input.agents.map((a) => ({
      label: `Subagent: ${a.name}`,
      text: a.content,
    })),
    ...input.skills.map((s) => ({
      label: `Skill: ${s.name}`,
      text: s.content,
    })),
    ...input.commands.map((c) => ({
      label: `Command: ${c.name}`,
      text: c.content,
    })),
    ...input.rules.map((r) => ({ label: `Rule: ${r.name}`, text: r.content })),
  ]
  for (const c of detectInstructionConflicts(conflictSources)) {
    add({
      id: `conflict-${findings.length}`,
      severity: c.severity,
      category: c.kind === 'contradiction' ? 'Conflicts' : 'Duplication',
      title:
        c.kind === 'contradiction'
          ? 'Contradictory instructions'
          : 'Duplicated instruction',
      detail: `${c.message} (${c.sources.join(', ')})`,
    })
  }

  return findings
}
