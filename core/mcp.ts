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
 * Code to relocate its config), otherwise `~/.claude.json`. `basePath` is
 * accepted for API symmetry but user-scope MCP is always home-relative.
 */
function userConfigPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR?.trim()
  if (dir) return path.join(dir, '.claude.json')
  return path.join(os.homedir(), '.claude.json')
}

export async function readMcpServers(
  _basePath: string,
): Promise<McpServerEntry[]> {
  const file = await readJsonFile<ClaudeUserConfig>(userConfigPath(), {})
  const servers = file.mcpServers ?? {}
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

export async function writeMcpServers(
  _basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const p = userConfigPath()
  // Re-read immediately before writing to minimize the lost-update window with
  // a running Claude Code, and to keep all sibling keys intact.
  const file = await readJsonFile<ClaudeUserConfig>(p, {})
  const existing = file.mcpServers ?? {}
  const out: Record<string, RawMcpServer> = {}

  for (const entry of entries) {
    // Start from the existing raw object so unknown fields survive a round-trip.
    const raw: RawMcpServer = { ...(existing[entry.name] ?? {}) }
    raw.type = entry.type

    if (entry.type === 'stdio') {
      if (entry.command) raw.command = entry.command
      else delete raw.command
      // Preserve a defined (even empty) args array; only drop when absent.
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

  file.mcpServers = out
  await writeJsonFile(p, file)
  return { success: true, path: p }
}
