/**
 * Heuristic conflict detection across the assembled context. These are
 * indicators, not proofs — they surface likely problems (contradictory rules,
 * duplicated instructions, clashing MCP wiring) so the user can investigate.
 */

export interface ContextSource {
  /** Where the text came from, shown in the warning. */
  label: string
  text: string
}

export type ConflictKind = 'contradiction' | 'duplicate' | 'mcp-collision'

export interface ConflictFinding {
  kind: ConflictKind
  severity: 'warning' | 'info'
  message: string
  /** Source labels involved. */
  sources: string[]
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'for',
  'and',
  'or',
  'in',
  'on',
  'is',
  'are',
  'be',
  'you',
  'your',
  'we',
  'it',
  'this',
  'that',
  'always',
  'never',
  'should',
  'must',
  'do',
  'not',
])

/**
 * Significant tokens of a directive predicate, for comparing two rules. Order is
 * preserved (not sorted): "always run tests before commit" and "never commit
 * before running tests" share the same token *set* but mean different things, so
 * a sorted key would falsely flag them as contradictory.
 */
function predicateKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .join(' ')
}

interface Directive {
  polarity: 'always' | 'never'
  key: string
  source: string
}

/** Pull "always …" / "never …" style directives out of a source's lines. */
function extractDirectives(source: ContextSource): Directive[] {
  const out: Directive[] = []
  for (const raw of source.text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/\b(always|never)\b(.*)$/i)
    if (!m) continue
    const key = predicateKey(m[2])
    if (key.split(' ').filter(Boolean).length < 2) continue
    out.push({
      polarity: m[1].toLowerCase() as 'always' | 'never',
      key,
      source: source.label,
    })
  }
  return out
}

/** Contradictions ("always X" vs "never X") and duplicated instructions. */
export function detectInstructionConflicts(
  sources: ContextSource[],
): ConflictFinding[] {
  const findings: ConflictFinding[] = []

  // --- always/never contradictions -----------------------------------------
  const directives = sources.flatMap(extractDirectives)
  const seenPairs = new Set<string>()
  for (const a of directives) {
    for (const b of directives) {
      if (a === b || a.polarity === b.polarity) continue
      if (a.key !== b.key) continue
      const pairId = [a.source, b.source].sort().join('::') + a.key
      if (seenPairs.has(pairId)) continue
      seenPairs.add(pairId)
      findings.push({
        kind: 'contradiction',
        severity: 'warning',
        message: `Conflicting rule about “${a.key}”: one source says always, another says never.`,
        sources: [...new Set([a.source, b.source])],
      })
    }
  }

  // --- duplicate instructions ----------------------------------------------
  const byLine = new Map<string, Set<string>>()
  for (const source of sources) {
    for (const raw of source.text.split('\n')) {
      const line = raw.trim()
      if (line.length < 25 || line.startsWith('#') || line.startsWith('|')) {
        continue
      }
      const norm = line.toLowerCase().replace(/\s+/g, ' ')
      const set = byLine.get(norm) ?? new Set<string>()
      set.add(source.label)
      byLine.set(norm, set)
    }
  }
  for (const [norm, srcs] of byLine) {
    if (srcs.size < 2) continue
    findings.push({
      kind: 'duplicate',
      severity: 'info',
      message: `Duplicate instruction repeated in ${srcs.size} sources: “${norm.slice(0, 80)}${norm.length > 80 ? '…' : ''}”`,
      sources: [...srcs],
    })
  }

  return findings
}

export interface AgentMcpServer {
  name: string
  command?: string
  args?: string[]
  url?: string
}

export interface AgentMcp {
  agentId: string
  servers: AgentMcpServer[]
}

function signature(s: AgentMcpServer): string {
  return s.url ?? `${s.command ?? ''} ${(s.args ?? []).join(' ')}`.trim()
}

/** Cross-agent MCP clashes: shared URLs/routes or divergent same-named servers. */
export function detectMcpConflicts(agents: AgentMcp[]): ConflictFinding[] {
  const findings: ConflictFinding[] = []

  // Same URL (host:port / route) targeted by more than one server.
  const byUrl = new Map<string, Set<string>>()
  for (const { agentId, servers } of agents) {
    for (const s of servers) {
      if (!s.url) continue
      const set = byUrl.get(s.url) ?? new Set<string>()
      set.add(`${agentId}:${s.name}`)
      byUrl.set(s.url, set)
    }
  }
  for (const [url, refs] of byUrl) {
    if (refs.size < 2) continue
    findings.push({
      kind: 'mcp-collision',
      severity: 'warning',
      message: `${refs.size} MCP servers target the same URL ${url} — they may clash on port/route.`,
      sources: [...refs],
    })
  }

  // Same server name, different wiring across agents.
  const byName = new Map<string, { agentId: string; sig: string }[]>()
  for (const { agentId, servers } of agents) {
    for (const s of servers) {
      const list = byName.get(s.name) ?? []
      list.push({ agentId, sig: signature(s) })
      byName.set(s.name, list)
    }
  }
  for (const [name, defs] of byName) {
    const agentsForName = new Set(defs.map((d) => d.agentId))
    const sigs = new Set(defs.map((d) => d.sig))
    if (agentsForName.size >= 2 && sigs.size >= 2) {
      findings.push({
        kind: 'mcp-collision',
        severity: 'info',
        message: `MCP server “${name}” is defined differently across agents.`,
        sources: [...agentsForName],
      })
    }
  }

  return findings
}
