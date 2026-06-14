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
import { readMcpServers } from './mcp'
import { pathExists, readTextFile } from './json-file'
import type { AgentDefinition } from '@/shared/types/agent'

export type ValidationSeverity = 'warn' | 'error'

export interface ValidationFinding {
  severity: ValidationSeverity
  agentId: string
  agentName: string
  file: string
  message: string
}

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
    })
  } else if (result.content.trim() === '') {
    out.push({
      severity: 'warn',
      agentId: def.id,
      agentName: def.displayName,
      file: result.path,
      message: `Instruction file ${spec.filename} is empty`,
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

  // Derive the expected MCP file path per agent (mirrors logic in core/mcp.ts).
  let mcpFilePath: string
  if (def.id === 'codex') {
    mcpFilePath = path.join(basePath, 'config.toml')
  } else if (def.id === 'cursor') {
    mcpFilePath = path.join(basePath, 'mcp.json')
  } else if (def.id === 'gemini') {
    mcpFilePath = path.join(basePath, 'settings.json')
  } else if (def.id === 'copilot') {
    mcpFilePath = path.join(basePath, 'mcp-config.json')
  } else if (def.id === 'windsurf') {
    mcpFilePath = path.join(basePath, 'mcp_config.json')
  } else {
    // Claude: ~/.claude.json (user-scoped, outside basePath)
    const dir = process.env.CLAUDE_CONFIG_DIR?.trim()
    mcpFilePath = dir
      ? path.join(dir, '.claude.json')
      : path.join(
          process.env.HOME ?? process.env.USERPROFILE ?? basePath,
          '.claude.json',
        )
  }

  if (!(await pathExists(mcpFilePath))) return []

  try {
    await readMcpServers(def.id, basePath)
    return []
  } catch (err) {
    return [
      {
        severity: 'error',
        agentId: def.id,
        agentName: def.displayName,
        file: mcpFilePath,
        message:
          'MCP config could not be parsed: ' +
          (err instanceof Error ? err.message : String(err)),
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
