/**
 * Auto-detection of agent config directories. Node-only.
 */

import type { DetectedPath, OsEnv } from '@/shared/types/agent'
import {
  getActiveAgentDefinitions,
  getAgentDefinition,
} from '@/shared/agents/defs'
import { pathExists } from './json-file'

export async function detectAgentPaths(
  agentId: string,
  env: OsEnv,
): Promise<DetectedPath[]> {
  const def = getAgentDefinition(agentId)
  const candidates = def.resolvePaths(env)
  return Promise.all(
    candidates.map(async (p) => ({
      path: p,
      exists: await pathExists(p),
      source: 'auto' as const,
    })),
  )
}

export async function detectAllAgentPaths(
  env: OsEnv,
): Promise<Record<string, DetectedPath[]>> {
  const entries = await Promise.all(
    getActiveAgentDefinitions().map(
      async (def) => [def.id, await detectAgentPaths(def.id, env)] as const,
    ),
  )
  return Object.fromEntries(entries)
}

/**
 * Effective base directory for IO: an explicit user override wins, otherwise
 * the first existing candidate, otherwise the first (preferred) candidate.
 */
export async function effectiveBasePath(
  agentId: string,
  env: OsEnv,
  override?: string,
): Promise<string> {
  if (override && override.trim() !== '') return override
  const candidates = getAgentDefinition(agentId).resolvePaths(env)
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }
  return candidates[0]
}
