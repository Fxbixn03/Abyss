/**
 * Read / write agent instruction files (CLAUDE.md, AGENTS.md, ...). Node-only.
 *
 * Filenames come from the trusted agent definitions, never from user input.
 * They may be nested (e.g. Windsurf's `memories/global_rules.md`), so we resolve
 * them against the base and verify the result stays inside it — keeping the
 * path-traversal defense without forcing every file to the base level.
 */

import path from 'node:path'
import * as yaml from 'js-yaml'
import { getAgentDefinition } from '@/shared/agents/defs'
import type { ConfigFileSpec } from '@/shared/types/agent'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'
import { ConfigValidationError } from './config-error'

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
  const base = path.resolve(basePath)
  const resolved = path.resolve(base, spec.filename)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Config path escapes base directory: ${spec.filename}`)
  }
  return resolved
}

/**
 * Validate content against the spec's declared language before writing.
 *
 * Throws {@link ConfigValidationError} (carrying the resolved filePath) when
 * the language requires syntactically valid content and the content fails
 * parsing. Markdown and plain-text specs pass through unchecked.
 */
export function validateContent(
  spec: ConfigFileSpec,
  filePath: string,
  content: string,
): void {
  if (spec.language === 'json') {
    try {
      JSON.parse(content)
    } catch (cause) {
      throw new ConfigValidationError(filePath, 'Content is not valid JSON', cause)
    }
  } else if (spec.language === 'yaml') {
    try {
      yaml.load(content)
    } catch (cause) {
      throw new ConfigValidationError(filePath, 'Content is not valid YAML', cause)
    }
  }
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
  const def = getAgentDefinition(agentId)
  const spec = def.configFiles.find((s) => s.id === specId)
  if (!spec) {
    throw new Error(`Unknown config spec '${specId}' for agent '${agentId}'`)
  }
  const filePath = specFilePath(agentId, specId, basePath)
  validateContent(spec, filePath, content)
  await writeTextFileAtomic(filePath, content)
  return { success: true, path: filePath }
}
