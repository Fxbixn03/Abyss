/**
 * Multi-agent sync & compare. Reads a "surface" (instructions / mcp /
 * permissions) from one agent and compares or copies it to another, operating
 * on each agent's global config. Writes go through the shared IO (so the
 * snapshot safety net applies). Node-only.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { McpServerEntry } from '@/shared/types/config'
import type {
  AgentSurface,
  CopyResult,
  SurfaceComparison,
  SurfaceValue,
  SyncAllResult,
  SyncSurface,
} from '@/shared/types/sync'
import {
  getActiveAgentDefinitions,
  getAgentDefinition,
} from '@/shared/agents/defs'
import { effectiveBasePath } from './agent-paths'
import { readAgentConfigFile, writeAgentConfigFile } from './config-io'
import { readMcpServers, writeMcpServers } from './mcp'
import { readPermissions, writePermissions } from './claude-settings'

function supports(agentId: string, surface: SyncSurface): boolean {
  const c = getAgentDefinition(agentId).capabilities
  if (surface === 'instructions') return c.instructions
  if (surface === 'mcp') return c.mcp
  return c.permissions
}

export async function readSurface(
  env: OsEnv,
  agentId: string,
  surface: SyncSurface,
): Promise<AgentSurface> {
  if (!supports(agentId, surface)) {
    return { agentId, supported: false, value: null }
  }
  const base = await effectiveBasePath(agentId, env)

  if (surface === 'instructions') {
    const r = await readAgentConfigFile(agentId, 'instructions', base)
    return {
      agentId,
      supported: true,
      value: { kind: 'instructions', content: r.content },
      path: r.path,
    }
  }
  if (surface === 'mcp') {
    const servers = await readMcpServers(agentId, base)
    return { agentId, supported: true, value: { kind: 'mcp', servers } }
  }
  const rules = await readPermissions(base)
  return { agentId, supported: true, value: { kind: 'permissions', rules } }
}

/** A stable string for equality, ignoring volatile fields (e.g. mcp ids). */
function valueKey(value: SurfaceValue | null): string {
  if (!value) return ''
  if (value.kind === 'instructions') return value.content
  if (value.kind === 'mcp') return normalizeMcp(value.servers)
  const r = value.rules
  return JSON.stringify({
    allow: [...r.allow].sort(),
    deny: [...r.deny].sort(),
    ask: [...r.ask].sort(),
  })
}

function normalizeMcp(servers: McpServerEntry[]): string {
  return JSON.stringify(
    [...servers]
      .map((s) => ({
        name: s.name,
        type: s.type,
        command: s.command,
        args: s.args,
        url: s.url,
        env: s.env,
        enabled: s.enabled,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export async function compareSurface(
  env: OsEnv,
  surface: SyncSurface,
  agentA: string,
  agentB: string,
): Promise<SurfaceComparison> {
  const [a, b] = await Promise.all([
    readSurface(env, agentA, surface),
    readSurface(env, agentB, surface),
  ])
  const equal =
    a.supported && b.supported && valueKey(a.value) === valueKey(b.value)
  return { surface, a, b, equal }
}

export async function copySurface(
  env: OsEnv,
  surface: SyncSurface,
  fromAgent: string,
  toAgent: string,
  dryRun: boolean,
): Promise<CopyResult> {
  const src = await readSurface(env, fromAgent, surface)
  if (!src.supported || !src.value) {
    throw new Error(`${fromAgent} has no ${surface} to copy.`)
  }
  if (!supports(toAgent, surface)) {
    throw new Error(`${toAgent} does not support ${surface}.`)
  }

  const toBase = await effectiveBasePath(toAgent, env)
  const before = await readSurface(env, toAgent, surface)
  const changed = valueKey(before.value) !== valueKey(src.value)

  if (src.value.kind === 'instructions') {
    const current = await readAgentConfigFile(toAgent, 'instructions', toBase)
    if (changed && !dryRun) {
      await writeAgentConfigFile(
        toAgent,
        'instructions',
        toBase,
        src.value.content,
      )
    }
    return { changed, target: current.path }
  }
  if (src.value.kind === 'mcp') {
    if (changed && !dryRun) {
      const r = await writeMcpServers(toAgent, toBase, src.value.servers)
      return { changed, target: r.path }
    }
    return { changed, target: `${toBase} (MCP)` }
  }
  if (changed && !dryRun) {
    const r = await writePermissions(toBase, src.value.rules)
    return { changed, target: r.path }
  }
  return { changed, target: `${toBase}/settings.json` }
}

/** Push one agent's MCP servers to every other MCP-capable agent. */
export async function syncMcpToAll(
  env: OsEnv,
  fromAgent: string,
  dryRun: boolean,
): Promise<SyncAllResult[]> {
  const targets = getActiveAgentDefinitions()
    .filter((d) => d.capabilities.mcp && d.id !== fromAgent)
    .map((d) => d.id)

  const out: SyncAllResult[] = []
  for (const toAgent of targets) {
    const r = await copySurface(env, 'mcp', fromAgent, toAgent, dryRun)
    out.push({ agentId: toAgent, changed: r.changed, target: r.target })
  }
  return out
}
