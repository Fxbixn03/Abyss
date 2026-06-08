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
 */

import os from 'node:os'
import path from 'node:path'
import type { McpServerEntry } from '@/shared/types/config'
import { readJsonFile, writeJsonFile } from './json-file'
import { readCodexMcp, writeCodexMcp } from './mcp-codex'

interface RawMcpServer {
  type?: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  disabled?: boolean
  [key: string]: unknown
}

interface ClaudeUserConfig {
  mcpServers?: Record<string, RawMcpServer>
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

/** Generic reader for a `{ mcpServers: {...} }` JSON file (Claude / Cursor). */
async function readJsonMcp(file: string): Promise<McpServerEntry[]> {
  const data = await readJsonFile<ClaudeUserConfig>(file, {})
  const servers = data.mcpServers ?? {}
  return Object.entries(servers).map(([name, s], index) => ({
    id: `${name}-${index}`,
    name,
    type: s.type ?? (s.url ? 'http' : 'stdio'),
    command: s.command,
    args: s.args,
    url: s.url,
    env: s.env,
    enabled: s.disabled !== true,
  }))
}

async function writeJsonMcp(
  file: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  // Re-read immediately before writing to minimize the lost-update window and
  // keep all sibling keys (and unknown per-server fields) intact.
  const data = await readJsonFile<ClaudeUserConfig>(file, {})
  const existing = data.mcpServers ?? {}
  const out: Record<string, RawMcpServer> = {}

  for (const entry of entries) {
    const raw: RawMcpServer = { ...(existing[entry.name] ?? {}) }
    raw.type = entry.type

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
  await writeJsonFile(file, data)
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

/**
 * Read MCP servers for an agent. Claude/Cursor/Gemini use JSON, Codex uses TOML.
 * Claude: `~/.claude.json` / `<project>/.mcp.json`; Cursor: `<base>/mcp.json`;
 * Gemini: `<base>/settings.json`; Codex: `<base>/config.toml`.
 */
export function readMcpServers(
  agentId: string,
  basePath: string,
  projectDir?: string,
): Promise<McpServerEntry[]> {
  if (agentId === 'codex') return readCodexMcp(basePath)
  if (agentId === 'cursor') return readJsonMcp(cursorMcpPath(basePath))
  if (agentId === 'gemini') return readJsonMcp(geminiSettingsPath(basePath))
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
  return writeJsonMcp(mcpConfigPath(projectDir), entries)
}
