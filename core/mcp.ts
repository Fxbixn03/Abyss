/**
 * Read / write MCP servers for Claude Code. Node-only.
 *
 * Claude stores **user-scoped** MCP servers in `~/.claude.json` (NOT inside the
 * ~/.claude directory) under a top-level `mcpServers` map:
 *   { "mcpServers": { "<name>": { "type", "command", "args", "env" | "url" } } }
 *
 * We read/write that real file and carefully preserve every other key (projects,
 * oauthAccount, caches, …) and any unknown per-server fields, so Abyss can never
 * clobber the live config.
 *
 * Goose (Block) uses a YAML-based format (`~/.config/goose/config.yaml`) with an
 * `extensions` key instead of `mcpServers`. Each extension entry is mapped to a
 * {@link McpServerEntry} on read and written back while preserving all other keys.
 */

import os from 'node:os'
import path from 'node:path'
import * as yaml from 'js-yaml'
import type { McpServerEntry } from '@/shared/types/config'
import { claudeMcpFileSchema } from '@/shared/schemas/config.schemas'
import { readJsonFile, writeJsonFile, pathExists, readTextFile, writeTextFileAtomic } from './json-file'
import { codexConfigPath, readCodexMcp, writeCodexMcp } from './mcp-codex'
import { ConfigParseError } from './config-error'
import { z } from 'zod'

/**
 * Lenient schema for Zed's `settings.json`. We only look at `context_servers`;
 * all other keys are preserved via `.passthrough()` so Abyss never clobbers
 * keymaps, themes, or any other Zed configuration.
 */
const zedSettingsSchema = z
  .object({
    context_servers: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

type ZedSettings = z.infer<typeof zedSettingsSchema>

interface RawMcpServer {
  // Free-form to tolerate agent-specific stdio tokens (Copilot uses "local").
  type?: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  disabled?: boolean
  [key: string]: unknown
}

/**
 * Location of Claude's user config. Honors CLAUDE_CONFIG_DIR (used by Claude
 * Code to relocate its config), otherwise `~/.claude.json`.
 */
function userConfigPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR?.trim()
  if (dir) return path.join(dir, '.claude.json')
  return path.join(os.homedir(), '.claude.json')
}

/**
 * Which file holds the `mcpServers` map. Global (user) scope lives in
 * `~/.claude.json`; project scope lives in `<projectDir>/.mcp.json`.
 */
function mcpConfigPath(projectDir?: string): string {
  return projectDir ? path.join(projectDir, '.mcp.json') : userConfigPath()
}

/**
 * The on-disk `type` value an agent uses for stdio (local) servers. Copilot CLI
 * writes `"local"` where Claude/Cursor/Gemini write `"stdio"`; everything else
 * about the `{ mcpServers: {...} }` shape matches, so we just translate this one
 * token on read/write and preserve unknown sibling fields.
 */
function stdioTypeFor(agentId: string): string {
  return agentId === 'copilot' ? 'local' : 'stdio'
}

/** Coerce a raw on-disk `type` token into the canonical transport union. */
function normalizeType(s: RawMcpServer): McpServerEntry['type'] {
  if (s.type === 'http' || s.type === 'sse') return s.type
  if (s.type === 'stdio' || s.type === 'local') return 'stdio'
  return s.url ? 'http' : 'stdio'
}

/** Generic reader for a `{ mcpServers: {...} }` JSON file (Claude / Cursor). */
async function readJsonMcp(file: string): Promise<McpServerEntry[]> {
  const data = await readJsonFile(file, {}, claudeMcpFileSchema)
  const servers = data.mcpServers ?? {}
  return Object.entries(servers).map(([name, s], index) => {
    const raw = s as RawMcpServer
    return {
      id: `${name}-${index}`,
      name,
      type: normalizeType(raw),
      command: raw.command,
      args: raw.args,
      url: raw.url,
      env: raw.env,
      enabled: raw.disabled !== true,
    }
  })
}

async function writeJsonMcp(
  file: string,
  entries: McpServerEntry[],
  stdioType = 'stdio',
): Promise<{ success: boolean; path: string }> {
  // Re-read immediately before writing to minimize the lost-update window and
  // keep all sibling keys (and unknown per-server fields) intact.
  const data = await readJsonFile(file, {}, claudeMcpFileSchema)
  const existing = (data.mcpServers ?? {}) as Record<string, RawMcpServer>
  const out: Record<string, RawMcpServer> = {}

  for (const entry of entries) {
    const raw: RawMcpServer = { ...(existing[entry.name] ?? {}) }
    raw.type = entry.type === 'stdio' ? stdioType : entry.type

    if (entry.type === 'stdio') {
      if (entry.command) raw.command = entry.command
      else delete raw.command
      if (entry.args !== undefined) raw.args = entry.args
      else delete raw.args
      delete raw.url
    } else {
      if (entry.url) raw.url = entry.url
      else delete raw.url
      delete raw.command
      delete raw.args
    }

    if (entry.env !== undefined) raw.env = entry.env
    else delete raw.env

    if (!entry.enabled) raw.disabled = true
    else delete raw.disabled

    out[entry.name] = raw
  }

  data.mcpServers = out
  await writeJsonFile(file, data, claudeMcpFileSchema)
  return { success: true, path: file }
}

/** Cursor stores MCP in `<base>/mcp.json` (same JSON shape as Claude). */
function cursorMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

/** Gemini keeps its `mcpServers` map inside `<base>/settings.json`. */
function geminiSettingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

/** Copilot CLI keeps its `mcpServers` map in `<base>/mcp-config.json`. */
function copilotMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp-config.json')
}

/** Windsurf keeps its `mcpServers` map in `<base>/mcp_config.json`. */
function windsurfMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp_config.json')
}

/** Roo Code keeps its `mcpServers` map in `<base>/mcp.json` (same shape as Cursor). */
function rooMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

/** Kiro (AWS) keeps its `mcpServers` map in `<base>/mcp.json` (same shape as Cursor/Roo). */
function kiroMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

/** Amazon Q Developer CLI keeps its `mcpServers` map in `<base>/mcp.json` (same shape as Cursor/Roo/Kiro). */
function amazonqMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

/** Plandex keeps its `mcpServers` map in `<base>/mcp.json` (standard `{ mcpServers }` JSON shape). */
function plandexMcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

/**
 * Cody CLI stores its full config (including `mcpServers`) in `config.json`
 * alongside `customInstructions` and other fields. The `writeJsonMcp` read-
 * merge-write cycle preserves every other key in that file.
 */
function codyMcpPath(basePath: string): string {
  return path.join(basePath, 'config.json')
}

/**
 * Cline stores MCP config at `~/Documents/Cline/mcp_settings.json`. Since
 * `clineDefinition.resolvePaths` returns `~/Documents/Cline/Rules`, we step
 * one level up to reach `~/Documents/Cline/`.
 */
function clineMcpPath(basePath: string): string {
  return path.join(basePath, '..', 'mcp_settings.json')
}

/**
 * Warp terminal AI stores its `mcpServers` map in `~/.warp/mcp.json`.
 * The agent base resolves to `~/.warp/agents`, so we step one level up.
 */
function warpMcpPath(basePath: string): string {
  return path.join(basePath, '..', 'mcp.json')
}

/** Amp (Sourcegraph) keeps its `mcpServers` map inside `<base>/settings.json` (same shape as Gemini). */
function ampMcpPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

/**
 * Zed Editor stores its full config (including MCP context servers) in
 * `<base>/settings.json` under the `context_servers` key. This is a different
 * key name from the `mcpServers` used by most other agents.
 */
function zedSettingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

/**
 * Raw shape of a single Zed context server entry. Zed uses similar fields to
 * the standard MCP stdio format, with `command` and `args`.
 */
interface ZedContextServer {
  command?: { path?: string; args?: string[] }
  settings?: Record<string, unknown>
  [key: string]: unknown
}

export async function readZedMcp(basePath: string): Promise<McpServerEntry[]> {
  const file = zedSettingsPath(basePath)
  const data = await readJsonFile(file, {} as ZedSettings, zedSettingsSchema)
  const servers = data.context_servers ?? {}
  return Object.entries(servers).map(([name, rawEntry], index) => {
    const entry = (rawEntry ?? {}) as ZedContextServer
    const cmd = entry.command
    return {
      id: `${name}-${index}`,
      name,
      type: 'stdio' as const,
      command: cmd?.path,
      args: cmd?.args,
      enabled: true,
    }
  })
}

export async function writeZedMcp(
  basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const file = zedSettingsPath(basePath)
  // Re-read to preserve all other top-level keys (keymaps, theme, etc.)
  const data = await readJsonFile(file, {} as ZedSettings, zedSettingsSchema)
  const existing = (data.context_servers ?? {}) as Record<string, ZedContextServer>
  const out: Record<string, ZedContextServer> = {}

  for (const entry of entries) {
    const prev: ZedContextServer = { ...(existing[entry.name] ?? {}) }
    // Zed only supports stdio-style (command + args) for context servers
    const command: ZedContextServer['command'] = {
      ...(prev.command ?? {}),
    }
    if (entry.command) command.path = entry.command
    else delete command.path
    if (entry.args !== undefined) command.args = entry.args
    else delete command.args
    prev.command = command
    // Preserve any existing settings key and other unknown fields
    out[entry.name] = prev
  }

  data.context_servers = out
  await writeJsonFile(file, data, zedSettingsSchema)
  return { success: true, path: file }
}

/**
 * Continue stores its full config (including MCP servers) in `config.yaml`
 * under `~/.continue`. The `mcpServers` key uses the same shape as the standard
 * JSON agents (`command`, `args`, `url`, `env`, `disabled`), but serialized as
 * YAML. All other top-level keys (`models`, `context`, `rules`, …) are
 * preserved on every write.
 */
function continueConfigPath(basePath: string): string {
  return path.join(basePath, 'config.yaml')
}

/**
 * Raw shape of `~/.continue/config.yaml` — we only read `mcpServers`;
 * all other top-level keys are preserved as unknown pass-through.
 */
interface ContinueConfig {
  mcpServers?: Record<string, RawMcpServer>
  [key: string]: unknown
}

async function readContinueYaml(file: string): Promise<ContinueConfig> {
  if (!(await pathExists(file))) return {}
  const raw = await readTextFile(file)
  if (raw.trim() === '') return {}
  try {
    const parsed = yaml.load(raw)
    if (parsed === null || parsed === undefined) return {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as ContinueConfig
  } catch (err) {
    throw new ConfigParseError(file, err)
  }
}

export async function readContinueMcp(basePath: string): Promise<McpServerEntry[]> {
  const file = continueConfigPath(basePath)
  const data = await readContinueYaml(file)
  const servers = data.mcpServers ?? {}
  return Object.entries(servers).map(([name, s], index) => {
    const raw = s as RawMcpServer
    return {
      id: `${name}-${index}`,
      name,
      type: normalizeType(raw),
      command: raw.command,
      args: raw.args,
      url: raw.url,
      env: raw.env,
      enabled: raw.disabled !== true,
    }
  })
}

export async function writeContinueMcp(
  basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const file = continueConfigPath(basePath)
  // Re-read to preserve all other top-level YAML keys (models, context, rules, …).
  const data = await readContinueYaml(file)
  const existing = data.mcpServers ?? {}
  const out: Record<string, RawMcpServer> = {}

  for (const entry of entries) {
    const raw: RawMcpServer = { ...(existing[entry.name] ?? {}) }
    raw.type = entry.type === 'stdio' ? 'stdio' : entry.type

    if (entry.type === 'stdio') {
      if (entry.command) raw.command = entry.command
      else delete raw.command
      if (entry.args !== undefined) raw.args = entry.args
      else delete raw.args
      delete raw.url
    } else {
      if (entry.url) raw.url = entry.url
      else delete raw.url
      delete raw.command
      delete raw.args
    }

    if (entry.env !== undefined) raw.env = entry.env
    else delete raw.env

    if (!entry.enabled) raw.disabled = true
    else delete raw.disabled

    out[entry.name] = raw
  }

  data.mcpServers = out
  await writeTextFileAtomic(file, yaml.dump(data, { lineWidth: -1 }))
  return { success: true, path: file }
}

/**
 * Goose (Block) keeps MCP-compatible extensions in `config.yaml` under the
 * `extensions` key. The file lives at `<base>/config.yaml` where `base` is
 * `~/.config/goose` on Linux/macOS or `%APPDATA%\goose` on Windows.
 */
function gooseConfigPath(basePath: string): string {
  return path.join(basePath, 'config.yaml')
}

/**
 * Raw shape of a single Goose extension entry inside `extensions.<name>`.
 * Goose supports stdio extensions (cmd/args) and remote extensions (url).
 */
interface GooseExtension {
  type?: string
  cmd?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  enabled?: boolean
  [key: string]: unknown
}

/**
 * Raw shape of `~/.config/goose/config.yaml` — we only read `extensions`;
 * all other top-level keys are preserved as unknown pass-through.
 */
interface GooseConfig {
  extensions?: Record<string, GooseExtension>
  [key: string]: unknown
}

async function readGooseYaml(file: string): Promise<GooseConfig> {
  if (!(await pathExists(file))) return {}
  const raw = await readTextFile(file)
  if (raw.trim() === '') return {}
  try {
    const parsed = yaml.load(raw)
    if (parsed === null || parsed === undefined) return {}
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as GooseConfig
  } catch (err) {
    throw new ConfigParseError(file, err)
  }
}

/** Map a Goose `type` token to the canonical {@link McpServerEntry} transport. */
function gooseNormalizeType(ext: GooseExtension): McpServerEntry['type'] {
  if (ext.type === 'http' || ext.type === 'sse') return ext.type
  if (ext.url && !ext.cmd) return 'http'
  return 'stdio'
}

export async function readGooseMcp(basePath: string): Promise<McpServerEntry[]> {
  const file = gooseConfigPath(basePath)
  const data = await readGooseYaml(file)
  const extensions = data.extensions ?? {}
  return Object.entries(extensions).map(([name, ext], index) => ({
    id: `${name}-${index}`,
    name,
    type: gooseNormalizeType(ext),
    command: ext.cmd,
    args: ext.args,
    url: ext.url,
    env: ext.env,
    enabled: ext.enabled !== false,
  }))
}

export async function writeGooseMcp(
  basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const file = gooseConfigPath(basePath)
  // Re-read to preserve all other top-level YAML keys.
  const data = await readGooseYaml(file)
  const existing = data.extensions ?? {}
  const out: Record<string, GooseExtension> = {}

  for (const entry of entries) {
    const prev: GooseExtension = { ...(existing[entry.name] ?? {}) }
    prev.type = entry.type === 'stdio' ? 'stdio' : entry.type

    if (entry.type === 'stdio') {
      if (entry.command) prev.cmd = entry.command
      else delete prev.cmd
      if (entry.args !== undefined) prev.args = entry.args
      else delete prev.args
      delete prev.url
    } else {
      if (entry.url) prev.url = entry.url
      else delete prev.url
      delete prev.cmd
      delete prev.args
    }

    if (entry.env !== undefined) prev.env = entry.env
    else delete prev.env

    prev.enabled = entry.enabled

    out[entry.name] = prev
  }

  data.extensions = out
  await writeTextFileAtomic(file, yaml.dump(data, { lineWidth: -1 }))
  return { success: true, path: file }
}

/**
 * Return the on-disk path of the file that holds MCP server config for the
 * given agent. Mirrors the routing in {@link readMcpServers} so callers can
 * check path existence without re-deriving it independently.
 */
export function getMcpConfigPath(
  agentId: string,
  basePath: string,
  projectDir?: string,
): string {
  if (agentId === 'codex') return codexConfigPath(basePath)
  if (agentId === 'cursor') return cursorMcpPath(basePath)
  if (agentId === 'gemini') return geminiSettingsPath(basePath)
  if (agentId === 'copilot') return copilotMcpPath(basePath)
  if (agentId === 'windsurf') return windsurfMcpPath(basePath)
  if (agentId === 'roo') return rooMcpPath(basePath)
  if (agentId === 'kiro') return kiroMcpPath(basePath)
  if (agentId === 'amazonq') return amazonqMcpPath(basePath)
  if (agentId === 'plandex') return plandexMcpPath(basePath)
  if (agentId === 'cody') return codyMcpPath(basePath)
  if (agentId === 'amp') return ampMcpPath(basePath)
  if (agentId === 'warp') return warpMcpPath(basePath)
  if (agentId === 'cline') return clineMcpPath(basePath)
  if (agentId === 'continue') return continueConfigPath(basePath)
  if (agentId === 'goose') return gooseConfigPath(basePath)
  if (agentId === 'zed') return zedSettingsPath(basePath)
  return mcpConfigPath(projectDir)
}

/**
 * Read MCP servers for an agent. Claude/Cursor/Gemini/Copilot use JSON, Codex
 * uses TOML, Goose uses YAML (`extensions` key). Claude: `~/.claude.json` /
 * `<project>/.mcp.json`; Cursor: `<base>/mcp.json`; Gemini:
 * `<base>/settings.json`; Copilot: `<base>/mcp-config.json`; Codex:
 * `<base>/config.toml`; Goose: `<base>/config.yaml`.
 */
export function readMcpServers(
  agentId: string,
  basePath: string,
  projectDir?: string,
): Promise<McpServerEntry[]> {
  if (agentId === 'codex') return readCodexMcp(basePath)
  if (agentId === 'cursor') return readJsonMcp(cursorMcpPath(basePath))
  if (agentId === 'gemini') return readJsonMcp(geminiSettingsPath(basePath))
  if (agentId === 'copilot') return readJsonMcp(copilotMcpPath(basePath))
  if (agentId === 'windsurf') return readJsonMcp(windsurfMcpPath(basePath))
  if (agentId === 'roo') return readJsonMcp(rooMcpPath(basePath))
  if (agentId === 'kiro') return readJsonMcp(kiroMcpPath(basePath))
  if (agentId === 'amazonq') return readJsonMcp(amazonqMcpPath(basePath))
  if (agentId === 'plandex') return readJsonMcp(plandexMcpPath(basePath))
  if (agentId === 'cody') return readJsonMcp(codyMcpPath(basePath))
  if (agentId === 'amp') return readJsonMcp(ampMcpPath(basePath))
  if (agentId === 'warp') return readJsonMcp(warpMcpPath(basePath))
  if (agentId === 'cline') return readJsonMcp(clineMcpPath(basePath))
  if (agentId === 'continue') return readContinueMcp(basePath)
  if (agentId === 'goose') return readGooseMcp(basePath)
  if (agentId === 'zed') return readZedMcp(basePath)
  return readJsonMcp(mcpConfigPath(projectDir))
}

export function writeMcpServers(
  agentId: string,
  basePath: string,
  entries: McpServerEntry[],
  projectDir?: string,
): Promise<{ success: boolean; path: string }> {
  if (agentId === 'codex') return writeCodexMcp(basePath, entries)
  if (agentId === 'cursor')
    return writeJsonMcp(cursorMcpPath(basePath), entries)
  if (agentId === 'gemini')
    return writeJsonMcp(geminiSettingsPath(basePath), entries)
  if (agentId === 'copilot')
    return writeJsonMcp(copilotMcpPath(basePath), entries, stdioTypeFor(agentId))
  if (agentId === 'windsurf')
    return writeJsonMcp(windsurfMcpPath(basePath), entries)
  if (agentId === 'roo')
    return writeJsonMcp(rooMcpPath(basePath), entries)
  if (agentId === 'kiro')
    return writeJsonMcp(kiroMcpPath(basePath), entries)
  if (agentId === 'amazonq')
    return writeJsonMcp(amazonqMcpPath(basePath), entries)
  if (agentId === 'plandex')
    return writeJsonMcp(plandexMcpPath(basePath), entries)
  if (agentId === 'cody')
    return writeJsonMcp(codyMcpPath(basePath), entries)
  if (agentId === 'amp')
    return writeJsonMcp(ampMcpPath(basePath), entries)
  if (agentId === 'warp')
    return writeJsonMcp(warpMcpPath(basePath), entries)
  if (agentId === 'cline')
    return writeJsonMcp(clineMcpPath(basePath), entries)
  if (agentId === 'continue')
    return writeContinueMcp(basePath, entries)
  if (agentId === 'goose')
    return writeGooseMcp(basePath, entries)
  if (agentId === 'zed')
    return writeZedMcp(basePath, entries)
  return writeJsonMcp(mcpConfigPath(projectDir), entries)
}
