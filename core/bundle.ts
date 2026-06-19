/**
 * Export / apply a portable config bundle. Powers the `abyss` CLI and any
 * future "export to file / apply on another machine" flow. Node-only.
 */

import type { OsEnv } from '@/shared/types/agent'
import type {
  AgentBundle,
  ApplyChange,
  ExportBundle,
} from '@/shared/types/bundle'
import {
  getActiveAgentDefinitions,
  getAgentDefinition,
} from '@/shared/agents/defs'
import { effectiveBasePath } from './agent-paths'
import { readAgentConfigFile, writeAgentConfigFile } from './config-io'
import {
  ConfigValidationError,
  ConfigReadError,
  ConfigParseError,
  ConfigNotFoundError,
} from './config-error'
import { readMcpServers, writeMcpServers } from './mcp'
import { readPermissions, writePermissions } from './claude-settings'

export type {
  AgentBundle,
  ApplyChange,
  ExportBundle,
} from '@/shared/types/bundle'

export interface ExportOptions {
  agentIds?: string[]
  basePaths?: Record<string, string>
}

export async function exportBundle(
  env: OsEnv,
  opts: ExportOptions = {},
): Promise<ExportBundle> {
  const ids = opts.agentIds ?? getActiveAgentDefinitions().map((d) => d.id)
  const agents: AgentBundle[] = []
  const skippedAgents: string[] = []

  for (const id of ids) {
    try {
      const def = getAgentDefinition(id)
      const basePath = await effectiveBasePath(id, env, opts.basePaths?.[id])
      const files: Record<string, string> = {}
      for (const spec of def.configFiles) {
        const result = await readAgentConfigFile(id, spec.id, basePath)
        files[spec.id] = result.content
      }
      const bundle: AgentBundle = { agentId: id, basePath, files }
      if (def.capabilities.mcp) {
        bundle.mcpServers = await readMcpServers(id, basePath)
      }
      if (def.capabilities.permissions) {
        bundle.permissions = await readPermissions(basePath)
      }
      agents.push(bundle)
    } catch (err) {
      if (
        err instanceof ConfigReadError ||
        err instanceof ConfigParseError ||
        err instanceof ConfigNotFoundError
      ) {
        const reason = err instanceof Error ? err.message : String(err)
        agents.push({
          agentId: id,
          basePath: opts.basePaths?.[id] ?? '',
          files: {},
          skipped: true,
          skipReason: reason,
        })
        skippedAgents.push(id)
      } else {
        throw err
      }
    }
  }

  const result: ExportBundle = {
    $schema: 'abyss-bundle/v1',
    version: 1,
    exportedAt: new Date().toISOString(),
    agents: agents.filter((a) => !a.skipped),
  }
  if (skippedAgents.length > 0) {
    result.skippedAgents = skippedAgents
  }
  return result
}

export interface ApplyOptions {
  dryRun?: boolean
  basePaths?: Record<string, string>
}

export async function applyBundle(
  bundle: ExportBundle,
  opts: ApplyOptions = {},
): Promise<ApplyChange[]> {
  const changes: ApplyChange[] = []

  const activeIds = new Set(getActiveAgentDefinitions().map((d) => d.id))
  for (const agent of bundle.agents) {
    if (!activeIds.has(agent.agentId)) {
      throw new ConfigValidationError(
        'bundle',
        `Unknown agent id in bundle: ${agent.agentId} — refusing to apply`,
      )
    }
  }

  for (const agent of bundle.agents) {
    const def = getAgentDefinition(agent.agentId)
    const basePath = opts.basePaths?.[agent.agentId] ?? agent.basePath

    for (const [specId, content] of Object.entries(agent.files)) {
      const current = await readAgentConfigFile(agent.agentId, specId, basePath)
      const changed = current.content !== content
      if (changed && !opts.dryRun) {
        await writeAgentConfigFile(agent.agentId, specId, basePath, content)
      }
      changes.push({
        agentId: agent.agentId,
        kind: 'file',
        target: current.path,
        changed,
      })
    }

    if (def.capabilities.mcp && agent.mcpServers) {
      const before = await readMcpServers(agent.agentId, basePath)
      const changed =
        JSON.stringify(before) !== JSON.stringify(agent.mcpServers)
      if (changed && !opts.dryRun) {
        await writeMcpServers(agent.agentId, basePath, agent.mcpServers)
      }
      changes.push({
        agentId: agent.agentId,
        kind: 'mcp',
        target: `${basePath}/mcp.json`,
        changed,
      })
    }

    if (def.capabilities.permissions && agent.permissions) {
      const before = await readPermissions(basePath)
      const changed =
        JSON.stringify(before) !== JSON.stringify(agent.permissions)
      if (changed && !opts.dryRun) {
        await writePermissions(basePath, agent.permissions)
      }
      changes.push({
        agentId: agent.agentId,
        kind: 'permissions',
        target: `${basePath}/settings.json`,
        changed,
      })
    }
  }

  return changes
}
