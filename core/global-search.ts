/**
 * Build a flat, searchable index of every agent's configuration — MCP servers,
 * lifecycle hooks, tool-permission rules and collection items (skills, slash
 * commands, subagents, rules). Powers the Command palette's cross-agent search.
 * Node-only. Every per-agent read is best-effort: a missing or corrupt file for
 * one agent never aborts the whole index.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { CollectionKind } from '@/shared/types/collections'
import type {
  GlobalSearchKind,
  GlobalSearchResult,
} from '@/shared/search/types'
import { getActiveAgentDefinitions } from '@/shared/agents/defs'
import { effectiveBasePath } from './agent-paths'
import { readMcpServers } from './mcp'
import { readHooks } from './hooks'
import { readPermissions } from './claude-settings'
import { listCollection } from './collections'

const COLLECTION_TO_KIND: Record<CollectionKind, GlobalSearchKind> = {
  skills: 'skill',
  commands: 'command',
  agents: 'subagent',
  rules: 'rule',
}

const COLLECTION_KINDS: CollectionKind[] = [
  'skills',
  'commands',
  'agents',
  'rules',
]

/**
 * Index the configs of every active agent. `overrides` maps agentId → explicit
 * base path (from app settings); absent agents fall back to auto-detection.
 */
export async function indexAllConfigs(
  env: OsEnv,
  overrides: Record<string, string> = {},
): Promise<GlobalSearchResult[]> {
  const perAgent = await Promise.all(
    getActiveAgentDefinitions().map((def) => indexAgent(def, env, overrides)),
  )
  return perAgent.flat()
}

async function indexAgent(
  def: ReturnType<typeof getActiveAgentDefinitions>[number],
  env: OsEnv,
  overrides: Record<string, string>,
): Promise<GlobalSearchResult[]> {
  const out: GlobalSearchResult[] = []
  const basePath = await effectiveBasePath(def.id, env, overrides[def.id])
  if (!basePath) return out
  const caps = def.capabilities

  if (caps.mcp) {
    for (const s of await safe(() => readMcpServers(def.id, basePath))) {
      out.push({
        agentId: def.id,
        kind: 'mcp',
        label: s.name,
        detail: s.command ?? s.url ?? '',
        route: '/mcp',
      })
    }
  }

  if (caps.hooks) {
    for (const h of await safe(() => readHooks(def.id, basePath))) {
      out.push({
        agentId: def.id,
        kind: 'hook',
        label: h.matcher ? `${h.event} · ${h.matcher}` : h.event,
        detail: h.command,
        route: '/hooks',
      })
    }
  }

  if (caps.permissions) {
    const rules = await safe(() => readPermissions(basePath), {
      allow: [],
      deny: [],
      ask: [],
    })
    for (const scope of ['allow', 'deny', 'ask'] as const) {
      for (const rule of rules[scope]) {
        out.push({
          agentId: def.id,
          kind: 'permission',
          label: rule,
          detail: scope,
          route: '/permissions',
        })
      }
    }
  }

  for (const kind of COLLECTION_KINDS) {
    if (!caps[kind]) continue
    for (const item of await safe(() => listCollection(def.id, basePath, kind))) {
      out.push({
        agentId: def.id,
        kind: COLLECTION_TO_KIND[kind],
        label: item.name,
        detail: item.description,
        route: `/${kind}`,
      })
    }
  }

  return out
}

/** Run a reader, swallowing failures (missing/corrupt files) to a fallback. */
async function safe<T>(fn: () => Promise<T>, fallback: T = [] as T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}
