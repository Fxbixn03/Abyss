/**
 * Read / write agent instruction files (CLAUDE.md, AGENTS.md, ...). Node-only.
 *
 * Filenames come from the trusted agent definitions, never from user input, and
 * are reduced to a basename to defend against path traversal.
 */

import path from 'node:path'
import { getAgentDefinition } from '@/shared/agents/defs'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'

export interface ReadConfigResult {
  content: string
  exists: boolean
  path: string
}

function specFilePath(
  agentId: string,
  specId: string,
  basePath: string,
): string {
  const def = getAgentDefinition(agentId)
  const spec = def.configFiles.find((s) => s.id === specId)
  if (!spec) {
    throw new Error(`Unknown config spec '${specId}' for agent '${agentId}'`)
  }
  return path.join(basePath, path.basename(spec.filename))
}

export async function readAgentConfigFile(
  agentId: string,
  specId: string,
  basePath: string,
): Promise<ReadConfigResult> {
  const filePath = specFilePath(agentId, specId, basePath)
  const exists = await pathExists(filePath)
  const content = exists ? await readTextFile(filePath) : ''
  return { content, exists, path: filePath }
}

export async function writeAgentConfigFile(
  agentId: string,
  specId: string,
  basePath: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const filePath = specFilePath(agentId, specId, basePath)
  await writeTextFileAtomic(filePath, content)
  return { success: true, path: filePath }
}
