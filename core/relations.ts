/**
 * Build the relation graph for one agent's configuration. Node-only.
 *
 * Nodes: every configurable component the agent supports — subagents, slash
 * commands, skills, rules, hooks, MCP servers and the main instruction file —
 * plus a central `agent` hub that `owns` them all.
 *
 * Edges are inferred from each component's content, split by confidence:
 *  - **structured** — unambiguous machine signals (`subagent_type:`,
 *    `mcp__server__…`, `/command`, a subagent's `tools:` frontmatter). Scanned on
 *    the RAW text, because these tokens are reliable even inside code blocks /
 *    examples (where Abyss configs love to put them).
 *  - **heuristic** — bare name/id mentions (`\bid\b`). Scanned only on the prose
 *    with code fences and inline code REMOVED via a real markdown parser
 *    (`mdast-util-from-markdown`), since that is exactly where a name appearing
 *    in a code example would otherwise create a false edge.
 *
 * Every read is best-effort: a missing or corrupt source is recorded in
 * `warnings` (so the renderer can prune positions conservatively) but never
 * aborts the whole graph.
 */

import path from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { AgentCapabilities } from '@/shared/types/agent'
import type { CollectionKind } from '@/shared/types/collections'
import type {
  RelationEdge,
  RelationEdgeKind,
  RelationGraph,
  RelationNode,
} from '@/shared/types/relations'
import { getAgentDefinition } from '@/shared/agents/defs'
import { parseFrontmatter } from './frontmatter'
import { pathExists, readTextFile } from './json-file'
import { listCollection } from './collections'
import { readHooks } from './hooks'
import { readMcpServers } from './mcp'

/** Stable id of the central hub node. */
const HUB_ID = 'agent:__hub__'

/** A node plus the raw text used to detect outgoing references. */
export interface RelationScanInput {
  node: RelationNode
  /** Raw content to scan (markdown file, hook command, MCP target). */
  content: string
}

/** Collection kinds that become nodes, in left-to-right lane order. */
const NODE_KINDS: { kind: CollectionKind; node: RelationNode['kind'] }[] = [
  { kind: 'commands', node: 'command' },
  { kind: 'agents', node: 'subagent' },
  { kind: 'skills', node: 'skill' },
  { kind: 'rules', node: 'rule' },
]

/**
 * Build the full graph for an agent at `basePath`. `projectDir` (project scope)
 * relocates the instruction file to the project root, matching the rest of the app.
 */
export async function buildRelationGraph(
  agentId: string,
  basePath: string,
  projectDir?: string,
): Promise<RelationGraph> {
  const def = getAgentDefinition(agentId)
  const caps: AgentCapabilities = def.capabilities
  const warnings: string[] = []
  const inputs: RelationScanInput[] = []

  // Central hub. No content to scan; it only owns the components.
  const hub: RelationNode = {
    id: HUB_ID,
    kind: 'agent',
    label: def.displayName,
    itemId: agentId,
    editable: false,
  }
  inputs.push({ node: hub, content: '' })

  // Markdown collections (commands / subagents / skills / rules).
  for (const { kind, node: nodeKind } of NODE_KINDS) {
    if (!caps[kind]) continue
    const items = await safe(
      () => listCollection(agentId, basePath, kind),
      [],
      warnings,
      `${kind} list`,
    )
    for (const item of items) {
      const content = await safe(
        () => readTextFile(item.path),
        '',
        warnings,
        item.path,
      )
      inputs.push({
        content,
        node: {
          id: `${nodeKind}:${item.id}`,
          kind: nodeKind,
          label: item.name,
          description: item.description || undefined,
          itemId: item.id,
          collectionKind: kind,
          filePath: item.path,
          editable: true,
        },
      })
    }
  }

  // Hooks (settings.json / flat hooks.json). Scanned via their command string.
  if (caps.hooks) {
    const hooks = await safe(
      () => readHooks(agentId, basePath),
      [],
      warnings,
      'hooks',
    )
    for (const hook of hooks) {
      const label = hook.matcher ? `${hook.event} · ${hook.matcher}` : hook.event
      inputs.push({
        content: `${hook.command} ${hook.matcher}`,
        node: {
          id: `hook:${hook.id}`,
          kind: 'hook',
          label,
          description: hook.command,
          itemId: hook.id,
          editable: false,
        },
      })
    }
  }

  // MCP servers.
  if (caps.mcp) {
    const servers = await safe(
      () => readMcpServers(agentId, basePath, projectDir),
      [],
      warnings,
      'mcp',
    )
    for (const server of servers) {
      const target = server.command ?? server.url ?? ''
      inputs.push({
        content: `${server.command ?? ''} ${(server.args ?? []).join(' ')} ${server.url ?? ''}`,
        node: {
          id: `mcp:${server.name}`,
          kind: 'mcp',
          label: server.name,
          description: target || undefined,
          itemId: server.name,
          editable: false,
        },
      })
    }
  }

  // Main instruction file (CLAUDE.md / AGENTS.md / …).
  if (caps.instructions && def.configFiles[0]) {
    const filename = def.configFiles[0].filename
    const file = path.join(projectDir ?? basePath, filename)
    if (await safe(() => pathExists(file), false, warnings, file)) {
      const content = await safe(() => readTextFile(file), '', warnings, file)
      inputs.push({
        content,
        node: {
          id: 'instructions:main',
          kind: 'instructions',
          label: filename,
          itemId: 'instructions',
          filePath: file,
          editable: false,
        },
      })
    }
  }

  const ownEdges: RelationEdge[] = inputs
    .filter((i) => i.node.id !== HUB_ID)
    .map((i) => ({
      id: `owns:${i.node.id}`,
      source: HUB_ID,
      target: i.node.id,
      kind: 'owns' as const,
      confidence: 'structured' as const,
    }))

  return {
    nodes: inputs.map((i) => i.node),
    edges: [...ownEdges, ...detectEdges(inputs)],
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Edge detection (pure — unit-tested directly)
// ---------------------------------------------------------------------------

/** Ambiguous short words that are also plausible ids — skipped on the heuristic
 *  path only (structured signals like `/build` still match). */
const HEURISTIC_STOPLIST = new Set([
  'build',
  'test',
  'review',
  'search',
  'run',
  'init',
  'plan',
  'loop',
  'docs',
  'help',
  'verify',
  'format',
  'lint',
  'sync',
  'fix',
  'add',
  'get',
  'set',
  'use',
  'all',
  'new',
  'task',
  'code',
  'file',
  'edit',
  'read',
  'list',
  'find',
  'main',
  'user',
  'data',
  'name',
  'type',
  'call',
])

const MCP_TOKEN_RE = /mcp__([a-z0-9_-]+)__/gi
const SUBAGENT_TYPE_RE = /subagent_type\s*[:=]\s*["']?([A-Za-z0-9._/-]+)/gi
// A slash command: `/id`, where id is kebab/namespaced. Excludes a trailing
// sentence period so `/deploy.` still resolves to the `deploy` command.
const SLASH_COMMAND_RE = /(?:^|[\s(`'"])\/([A-Za-z0-9][\w:-]*)/g

interface HeuristicTarget {
  nodeId: string
  edgeKind: RelationEdgeKind
  tokens: string[]
}

/**
 * Infer the directed reference edges between component nodes. Quote = the file
 * that mentions, target = the mentioned component. The hub and any non-targetable
 * kinds (rule / hook / instructions) are valid *sources* but never *targets*.
 */
export function detectEdges(inputs: RelationScanInput[]): RelationEdge[] {
  // Target indexes (built once → avoids re-deriving per source).
  const subagentIds = new Map<string, string>()
  const commandIds = new Map<string, string>()
  const mcpNames = new Map<string, string>()
  const heuristicTargets: HeuristicTarget[] = []

  for (const { node } of inputs) {
    if (node.kind === 'subagent') {
      register(subagentIds, node)
      heuristicTargets.push({
        nodeId: node.id,
        edgeKind: 'invokes-agent',
        tokens: [node.itemId, node.label],
      })
    } else if (node.kind === 'command') {
      register(commandIds, node)
      heuristicTargets.push({
        nodeId: node.id,
        edgeKind: 'invokes-command',
        tokens: [node.itemId, node.label],
      })
    } else if (node.kind === 'skill') {
      const leaf = node.itemId.split('/').pop() ?? node.itemId
      heuristicTargets.push({
        nodeId: node.id,
        edgeKind: 'uses-skill',
        tokens: [leaf, node.label],
      })
    } else if (node.kind === 'mcp') {
      mcpNames.set(node.itemId.toLowerCase(), node.id)
      heuristicTargets.push({
        nodeId: node.id,
        edgeKind: 'uses-mcp',
        tokens: [node.itemId],
      })
    }
  }

  const edges = new Map<string, RelationEdge>()
  const add = (
    source: string,
    target: string,
    kind: RelationEdgeKind,
    confidence: RelationEdge['confidence'],
  ) => {
    if (source === target) return
    const key = `${source}__${target}`
    const existing = edges.get(key)
    if (existing) {
      // Dedupe: structured beats heuristic, otherwise keep the first.
      if (existing.confidence === 'heuristic' && confidence === 'structured') {
        edges.set(key, { ...existing, kind, confidence })
      }
      return
    }
    edges.set(key, {
      id: `ref:${source}->${target}`,
      source,
      target,
      kind,
      confidence,
    })
  }

  for (const { node, content } of inputs) {
    if (!content) continue
    const source = node.id
    const { data, body } = parseFrontmatter(content)

    // --- structured (scanned on RAW text — reliable even inside code) ---

    // Subagent `tools:` frontmatter may list `mcp__server__tool` permissions.
    if (data.tools) {
      for (const m of data.tools.matchAll(MCP_TOKEN_RE)) {
        const id = mcpNames.get(m[1].toLowerCase())
        if (id) add(source, id, 'uses-mcp', 'structured')
      }
    }
    for (const m of body.matchAll(MCP_TOKEN_RE)) {
      const id = mcpNames.get(m[1].toLowerCase())
      if (id) add(source, id, 'uses-mcp', 'structured')
    }
    for (const m of body.matchAll(SUBAGENT_TYPE_RE)) {
      const id = subagentIds.get(m[1].toLowerCase())
      if (id) add(source, id, 'invokes-agent', 'structured')
    }
    for (const m of body.matchAll(SLASH_COMMAND_RE)) {
      const id = commandIds.get(m[1].toLowerCase())
      if (id) add(source, id, 'invokes-command', 'structured')
    }

    // --- heuristic (scanned on prose with code stripped out) ---
    const prose = extractProse(body)
    if (!prose) continue
    for (const target of heuristicTargets) {
      if (target.nodeId === source) continue
      for (const token of target.tokens) {
        if (!isHeuristicToken(token)) continue
        if (wordBoundaryMatch(prose, token)) {
          add(source, target.nodeId, target.edgeKind, 'heuristic')
          break
        }
      }
    }
  }

  return [...edges.values()]
}

function register(map: Map<string, string>, node: RelationNode): void {
  map.set(node.itemId.toLowerCase(), node.id)
  if (node.label) map.set(node.label.toLowerCase(), node.id)
}

function isHeuristicToken(token: string): boolean {
  return token.length >= 3 && !HEURISTIC_STOPLIST.has(token.toLowerCase())
}

const wordBoundaryCache = new Map<string, RegExp>()
function wordBoundaryMatch(haystack: string, token: string): boolean {
  let re = wordBoundaryCache.get(token)
  if (!re) {
    re = new RegExp(`(?<![\\w-])${escapeRegExp(token)}(?![\\w-])`, 'i')
    wordBoundaryCache.set(token, re)
  }
  return re.test(haystack)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Minimal mdast shape — avoids depending on `@types/mdast` directly. */
interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
}

/**
 * Markdown prose with code fences, inline code, raw HTML and frontmatter removed,
 * using a real parser (regex on raw markdown can't handle nested / tilde /
 * indented fences). Only text leaves are kept.
 */
function extractProse(markdown: string): string {
  const tree = fromMarkdown(markdown) as unknown as MdNode
  const out: string[] = []
  const walk = (node: MdNode) => {
    if (
      node.type === 'code' ||
      node.type === 'inlineCode' ||
      node.type === 'html' ||
      node.type === 'yaml'
    ) {
      return
    }
    if (node.type === 'text' && typeof node.value === 'string') {
      out.push(node.value)
    }
    node.children?.forEach(walk)
  }
  walk(tree)
  return out.join('\n')
}

/**
 * Run a best-effort read. On failure record `<label>: <reason>` in `warnings`
 * and return `fallback`, so one unreadable source never aborts the graph.
 */
async function safe<T>(
  fn: () => Promise<T>,
  fallback: T,
  warnings: string[],
  label: string,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    warnings.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    return fallback
  }
}
