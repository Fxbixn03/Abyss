/**
 * Static file-level validation for agent config files. Node-only.
 *
 * Checks instruction files (non-empty), settings.json (valid JSON) and MCP
 * config (valid JSON / parseable TOML) for each requested agent. Runs entirely
 * in the CLI process via core/ imports — no IPC, no GUI required.
 *
 * Deliberately kept separate from the Doctor engine: the Doctor focuses on
 * semantic correctness (risky rules, duplicate servers, …) while this module
 * focuses on basic structural validity suitable for a CI lint step.
 */

import path from 'node:path'
import { readAgentConfigFile } from './config-io'
import { getMcpConfigPath, readMcpServers } from './mcp'
import { readHooks, getHooksFilePath } from './hooks'
import { ConfigParseError } from './config-error'
import { pathExists, readTextFile } from './json-file'
import type { AgentDefinition } from '@/shared/types/agent'

export type { ValidationSeverity, ValidationFinding } from '@/shared/types/validation'
import type { ValidationFinding } from '@/shared/types/validation'

/** Check that the primary instruction file exists and is non-empty. */
async function checkInstructionFile(
  def: AgentDefinition,
  basePath: string,
): Promise<ValidationFinding[]> {
  const spec = def.configFiles.find((s) => s.id === 'instructions')
  if (!spec) return []

  const out: ValidationFinding[] = []
  let result: { content: string; exists: boolean; path: string }
  try {
    result = await readAgentConfigFile(def.id, 'instructions', basePath)
  } catch {
    // basePath doesn't exist yet — treat as missing
    result = {
      content: '',
      exists: false,
      path: path.join(basePath, spec.filename),
    }
  }

  if (!result.exists) {
    out.push({
      severity: 'warn',
      agentId: def.id,
      agentName: def.displayName,
      file: result.path,
      message: `Instruction file ${spec.filename} does not exist`,
      route: '/editor',
      suggestedAction: 'create-file',
    })
  } else if (result.content.trim() === '') {
    out.push({
      severity: 'warn',
      agentId: def.id,
      agentName: def.displayName,
      file: result.path,
      message: `Instruction file ${spec.filename} is empty`,
      route: '/editor',
      suggestedAction: 'open-raw-editor',
    })
  }

  return out
}

/** Check that settings.json is valid JSON (only for agents that have rawSettings). */
async function checkSettingsJson(
  def: AgentDefinition,
  basePath: string,
): Promise<ValidationFinding[]> {
  if (!def.capabilities.rawSettings) return []

  const settingsPath = path.join(basePath, 'settings.json')
  if (!(await pathExists(settingsPath))) return []

  const raw = await readTextFile(settingsPath)
  if (raw.trim() === '') return []

  try {
    JSON.parse(raw)
    return []
  } catch (err) {
    return [
      {
        severity: 'error',
        agentId: def.id,
        agentName: def.displayName,
        file: settingsPath,
        message:
          'settings.json contains invalid JSON: ' +
          (err instanceof Error ? err.message : String(err)),
        route: '/raw-settings',
        suggestedAction: 'repair-settings',
      },
    ]
  }
}

/** Check that the MCP config file is parseable (only for agents that have mcp). */
async function checkMcpConfig(
  def: AgentDefinition,
  basePath: string,
): Promise<ValidationFinding[]> {
  if (!def.capabilities.mcp) return []

  try {
    await readMcpServers(def.id, basePath)
    return []
  } catch (err) {
    // ConfigParseError already carries filePath; fall back to the path helper
    // for any unexpected error type so the finding always has a file reference.
    const filePath =
      err instanceof ConfigParseError
        ? err.filePath
        : getMcpConfigPath(def.id, basePath)

    return [
      {
        severity: 'error',
        agentId: def.id,
        agentName: def.displayName,
        file: filePath,
        message:
          'MCP config could not be parsed: ' +
          (err instanceof Error ? err.message : String(err)),
        route: '/mcp',
        suggestedAction: 'open-mcp',
      },
    ]
  }
}

/**
 * Check that the dedicated hooks config file is parseable (only for agents that
 * store hooks in a separate file — Gemini and Cursor). Agents that embed hooks
 * inside `settings.json` (e.g. Claude) are skipped here because `checkSettingsJson`
 * already covers them.
 */
async function checkHooks(
  def: AgentDefinition,
  basePath: string,
): Promise<ValidationFinding[]> {
  if (!def.capabilities.hooks) return []

  // If the agent has no dedicated hooks file it embeds hooks in settings.json,
  // which checkSettingsJson already validates — skip to avoid a duplicate finding.
  const hooksPath = getHooksFilePath(def.id, basePath)
  if (hooksPath === null) return []

  try {
    await readHooks(def.id, basePath)
    return []
  } catch (err) {
    // ConfigParseError carries filePath; fall back to the path helper for any
    // unexpected error type so the finding always has a file reference.
    const filePath =
      err instanceof ConfigParseError ? err.filePath : hooksPath

    return [
      {
        severity: 'error',
        agentId: def.id,
        agentName: def.displayName,
        file: filePath,
        message:
          'Hooks config could not be parsed: ' +
          (err instanceof Error ? err.message : String(err)),
        route: '/hooks',
        suggestedAction: 'open-hooks',
      },
    ]
  }
}

export interface ValidationAgentInput {
  def: AgentDefinition
  basePath: string
}

/** Run all file-level checks for the given agents and return a flat finding list. */
export async function runValidation(
  agents: ValidationAgentInput[],
): Promise<ValidationFinding[]> {
  const grouped = await Promise.all(
    agents.map(async ({ def, basePath }) => {
      const groups = await Promise.all([
        checkInstructionFile(def, basePath),
        checkSettingsJson(def, basePath),
        checkMcpConfig(def, basePath),
        checkHooks(def, basePath),
      ])
      return groups.flat()
    }),
  )

  // errors first, then warnings
  const findings = grouped.flat()
  return findings.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === 'error' ? -1 : 1
  })
}
