/**
 * Read / write MCP server entries (Claude Code) in `<basePath>/mcp.json`.
 * Node-only. Shape: `{ "mcpServers": { "<name>": { ... } } }`.
 */

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
}

interface McpFile {
  mcpServers?: Record<string, RawMcpServer>
  [key: string]: unknown
}

function mcpPath(basePath: string): string {
  return path.join(basePath, 'mcp.json')
}

export async function readMcpServers(
  basePath: string,
): Promise<McpServerEntry[]> {
  const file = await readJsonFile<McpFile>(mcpPath(basePath), {})
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
  basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const p = mcpPath(basePath)
  const file = await readJsonFile<McpFile>(p, {})
  const out: Record<string, RawMcpServer> = {}

  for (const entry of entries) {
    const raw: RawMcpServer = { type: entry.type }
    if (entry.type === 'stdio') {
      if (entry.command) raw.command = entry.command
      if (entry.args && entry.args.length > 0) raw.args = entry.args
    } else if (entry.url) {
      raw.url = entry.url
    }
    if (entry.env && Object.keys(entry.env).length > 0) raw.env = entry.env
    if (!entry.enabled) raw.disabled = true
    out[entry.name] = raw
  }

  file.mcpServers = out
  await writeJsonFile(p, file)
  return { success: true, path: p }
}
