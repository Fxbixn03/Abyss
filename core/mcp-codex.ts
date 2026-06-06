/**
 * Codex MCP servers, stored in `~/.codex/config.toml` (or `<base>/config.toml`)
 * under `[mcp_servers.<name>]` tables. Codex launches MCP servers as
 * subprocesses, so only the stdio transport applies. Node-only.
 *
 * NOTE: writing re-serializes the TOML (smol-toml), which preserves all other
 * keys but not comments/formatting. Validate against a real `~/.codex` install.
 */

import os from 'node:os'
import path from 'node:path'
import { parse, stringify } from 'smol-toml'
import type { McpServerEntry } from '@/shared/types/config'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'

interface CodexMcpServer {
  command?: string
  args?: string[]
  env?: Record<string, string>
  [key: string]: unknown
}

/** `basePath` is the `.codex` dir (global `~/.codex` or `<project>/.codex`). */
function codexConfigPath(basePath: string): string {
  const dir =
    basePath && basePath.trim() !== ''
      ? basePath
      : path.join(os.homedir(), '.codex')
  return path.join(dir, 'config.toml')
}

async function readToml(file: string): Promise<Record<string, unknown>> {
  if (!(await pathExists(file))) return {}
  try {
    return parse(await readTextFile(file)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function readCodexMcp(
  basePath: string,
): Promise<McpServerEntry[]> {
  const data = await readToml(codexConfigPath(basePath))
  const servers = (data.mcp_servers ?? {}) as Record<string, CodexMcpServer>
  return Object.entries(servers).map(([name, s], index) => ({
    id: `${name}-${index}`,
    name,
    type: 'stdio',
    command: typeof s.command === 'string' ? s.command : undefined,
    args: Array.isArray(s.args)
      ? s.args.filter((a): a is string => typeof a === 'string')
      : undefined,
    env:
      s.env && typeof s.env === 'object'
        ? (s.env as Record<string, string>)
        : undefined,
    enabled: true,
  }))
}

export async function writeCodexMcp(
  basePath: string,
  entries: McpServerEntry[],
): Promise<{ success: boolean; path: string }> {
  const file = codexConfigPath(basePath)
  // Preserve every other top-level key (model, approval_policy, …).
  const data = await readToml(file)

  const out: Record<string, CodexMcpServer> = {}
  for (const e of entries) {
    if (e.type !== 'stdio' || !e.command) continue
    const server: CodexMcpServer = { command: e.command }
    if (e.args && e.args.length > 0) server.args = e.args
    if (e.env && Object.keys(e.env).length > 0) server.env = e.env
    out[e.name] = server
  }
  data.mcp_servers = out

  await writeTextFileAtomic(file, stringify(data))
  return { success: true, path: file }
}
