/**
 * Abyss as an MCP server — the "AI-controllable interface". Exposes a focused
 * set of tools that let an MCP client (Claude Code, Cursor, …) inspect and edit
 * the same agent config Abyss's GUI manages, by reusing the very same `core/`
 * functions. Transport-agnostic: `cli/index.ts` wires this to a stdio JSON-RPC
 * loop via `abyss serve`. Node-only.
 */

import type { OsEnv } from '@/shared/types/agent'
import type { McpServerEntry } from '@/shared/types/config'
import { getAgentDefinition } from '@/shared/agents/defs'
import { detectAllAgentPaths, effectiveBasePath } from './agent-paths'
import { readMcpServers, writeMcpServers } from './mcp'
import { readAgentConfigFile, writeAgentConfigFile } from './config-io'
import { genId } from '@/shared/lib/id'

export interface AbyssMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface AbyssToolResult {
  text: string
  isError: boolean
}

/** A JSON Schema object with string-keyed properties — keeps tool defs terse. */
function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false }
}

const STR = { type: 'string' }
const BOOL = { type: 'boolean' }

export function listAbyssMcpTools(): AbyssMcpTool[] {
  return [
    {
      name: 'list_agents',
      description:
        'List every AI coding agent Abyss knows about and its detected on-disk config locations.',
      inputSchema: schema({}),
    },
    {
      name: 'list_mcp_servers',
      description:
        "List an agent's configured MCP servers (name, transport, command/url, enabled).",
      inputSchema: schema(
        {
          agentId: { ...STR, description: 'e.g. claude, codex, gemini, cursor' },
          basePath: { ...STR, description: 'Override the config base directory.' },
        },
        ['agentId'],
      ),
    },
    {
      name: 'add_mcp_server',
      description:
        'Add (or replace by name) an MCP server for an agent. Use type "stdio" with command/args, or "http"/"sse" with url.',
      inputSchema: schema(
        {
          agentId: STR,
          name: STR,
          type: { ...STR, enum: ['stdio', 'http', 'sse'] },
          command: STR,
          args: { type: 'array', items: STR },
          url: STR,
          basePath: STR,
        },
        ['agentId', 'name'],
      ),
    },
    {
      name: 'remove_mcp_server',
      description: 'Remove an MCP server from an agent by name.',
      inputSchema: schema(
        { agentId: STR, name: STR, basePath: STR },
        ['agentId', 'name'],
      ),
    },
    {
      name: 'set_mcp_server_enabled',
      description: 'Enable or disable an existing MCP server by name.',
      inputSchema: schema(
        { agentId: STR, name: STR, enabled: BOOL, basePath: STR },
        ['agentId', 'name', 'enabled'],
      ),
    },
    {
      name: 'read_instructions',
      description:
        "Read an agent's instruction file (e.g. CLAUDE.md / AGENTS.md). Omit specId to read the primary one.",
      inputSchema: schema(
        { agentId: STR, specId: STR, basePath: STR },
        ['agentId'],
      ),
    },
    {
      name: 'write_instructions',
      description:
        "Overwrite an agent's instruction file with new content. Omit specId to target the primary one.",
      inputSchema: schema(
        { agentId: STR, content: STR, specId: STR, basePath: STR },
        ['agentId', 'content'],
      ),
    },
  ]
}

// --- argument helpers (untrusted input from the MCP client) -----------------

function reqString(args: Record<string, unknown>, key: string): string {
  const v = args[key]
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`Missing required string argument: ${key}`)
  }
  return v
}

function optString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function optStringArray(args: Record<string, unknown>, key: string): string[] {
  const v = args[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function primarySpecId(agentId: string): string {
  const def = getAgentDefinition(agentId)
  const spec = def.configFiles[0]
  if (!spec) throw new Error(`Agent '${agentId}' has no config files.`)
  return spec.id
}

async function resolveBase(
  args: Record<string, unknown>,
  env: OsEnv,
  agentId: string,
): Promise<string> {
  return effectiveBasePath(agentId, env, optString(args, 'basePath'))
}

function ok(text: string): AbyssToolResult {
  return { text, isError: false }
}

// --- dispatch ---------------------------------------------------------------

export async function callAbyssMcpTool(
  name: string,
  args: Record<string, unknown>,
  env: OsEnv,
): Promise<AbyssToolResult> {
  try {
    switch (name) {
      case 'list_agents': {
        const detected = await detectAllAgentPaths(env)
        const lines = Object.entries(detected).map(([id, paths]) => {
          const def = getAgentDefinition(id)
          const where = paths
            .map((p) => `${p.exists ? '✓' : '·'} ${p.path}`)
            .join(', ')
          return `${def.displayName} (${id}): ${where || 'no known paths'}`
        })
        return ok(lines.join('\n'))
      }

      case 'list_mcp_servers': {
        const agentId = reqString(args, 'agentId')
        const base = await resolveBase(args, env, agentId)
        const servers = await readMcpServers(agentId, base)
        if (servers.length === 0) return ok(`No MCP servers configured for ${agentId}.`)
        return ok(JSON.stringify(servers, null, 2))
      }

      case 'add_mcp_server': {
        const agentId = reqString(args, 'agentId')
        const name_ = reqString(args, 'name')
        const base = await resolveBase(args, env, agentId)
        const type = (optString(args, 'type') ?? 'stdio') as McpServerEntry['type']
        const entry: McpServerEntry = {
          id: genId(),
          name: name_,
          type,
          command: optString(args, 'command'),
          args: optStringArray(args, 'args'),
          url: optString(args, 'url'),
          env: {},
          enabled: true,
        }
        const servers = await readMcpServers(agentId, base)
        const next = [...servers.filter((s) => s.name !== name_), entry]
        const res = await writeMcpServers(agentId, base, next)
        return ok(`Added MCP server "${name_}" to ${agentId} (${res.path}).`)
      }

      case 'remove_mcp_server': {
        const agentId = reqString(args, 'agentId')
        const name_ = reqString(args, 'name')
        const base = await resolveBase(args, env, agentId)
        const servers = await readMcpServers(agentId, base)
        if (!servers.some((s) => s.name === name_)) {
          return { text: `No MCP server named "${name_}" on ${agentId}.`, isError: true }
        }
        const next = servers.filter((s) => s.name !== name_)
        await writeMcpServers(agentId, base, next)
        return ok(`Removed MCP server "${name_}" from ${agentId}.`)
      }

      case 'set_mcp_server_enabled': {
        const agentId = reqString(args, 'agentId')
        const name_ = reqString(args, 'name')
        const enabled = args.enabled === true
        const base = await resolveBase(args, env, agentId)
        const servers = await readMcpServers(agentId, base)
        if (!servers.some((s) => s.name === name_)) {
          return { text: `No MCP server named "${name_}" on ${agentId}.`, isError: true }
        }
        const next = servers.map((s) =>
          s.name === name_ ? { ...s, enabled } : s,
        )
        await writeMcpServers(agentId, base, next)
        return ok(`${enabled ? 'Enabled' : 'Disabled'} "${name_}" on ${agentId}.`)
      }

      case 'read_instructions': {
        const agentId = reqString(args, 'agentId')
        const specId = optString(args, 'specId') ?? primarySpecId(agentId)
        const base = await resolveBase(args, env, agentId)
        const result = await readAgentConfigFile(agentId, specId, base)
        if (!result.exists) return ok(`(empty — ${result.path} does not exist yet)`)
        return ok(result.content)
      }

      case 'write_instructions': {
        const agentId = reqString(args, 'agentId')
        const content = reqString(args, 'content')
        const specId = optString(args, 'specId') ?? primarySpecId(agentId)
        const base = await resolveBase(args, env, agentId)
        const res = await writeAgentConfigFile(agentId, specId, base, content)
        return ok(`Wrote ${content.length} chars to ${res.path}.`)
      }

      default:
        return { text: `Unknown tool: ${name}`, isError: true }
    }
  } catch (err) {
    return {
      text: err instanceof Error ? err.message : String(err),
      isError: true,
    }
  }
}
