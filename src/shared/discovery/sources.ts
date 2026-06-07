/**
 * The known discovery sources, as pure data. The {@link DiscoverDialog} renders
 * one tab per source for a given kind; `core/discovery` backs the `search` ones.
 *
 * To make a new area discoverable, add sources here (with the new `kind`), then
 * implement a matching `DiscoveryProvider` in `core/discovery/`.
 */

import type { DiscoveryKind, DiscoverySource } from './types'

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    id: 'mcp-official',
    label: 'Official Registry',
    kinds: ['mcp'],
    mode: 'search',
    providerId: 'mcp-official',
    url: 'https://registry.modelcontextprotocol.io',
    description:
      'The official Model Context Protocol registry — searchable, with one-click setup.',
  },
  {
    id: 'mcp-so',
    label: 'mcp.so',
    kinds: ['mcp'],
    mode: 'website',
    url: 'https://mcp.so',
    description:
      'A large community directory of MCP servers. Browse it on the web, then add a server here with “Add server”.',
  },
  {
    id: 'mcpservers-org',
    label: 'mcpservers.org',
    kinds: ['mcp'],
    mode: 'website',
    url: 'https://mcpservers.org',
    description:
      'The “Awesome MCP Servers” directory. Browse it on the web, then add a server here with “Add server”.',
  },

  {
    id: 'a2a-registry',
    label: 'A2A Registry',
    kinds: ['agent'],
    mode: 'search',
    providerId: 'a2a-registry',
    url: 'https://a2aregistry.org',
    description:
      'The Agent2Agent (A2A) registry — interoperable agents that expose an agent card. Searchable; save one as a local subagent.',
  },
  {
    id: 'ai-agents-directory',
    label: 'AI Agents Directory',
    kinds: ['agent'],
    mode: 'search',
    providerId: 'ai-agents-directory',
    url: 'https://aiagentsdirectory.com',
    description:
      'A large directory of AI agent products. Searchable; save an entry as a local subagent to keep notes on it.',
  },
  {
    id: 'ai-agent-store',
    label: 'AI Agent Store',
    kinds: ['agent'],
    mode: 'website',
    url: 'https://aiagentstore.ai/ai-agents-directory',
    description:
      'A curated AI agent marketplace. Browse it on the web, then save an agent here with “New agent”.',
  },
]

/** Sources that can provide a given kind, in display order. */
export function sourcesForKind(kind: DiscoveryKind): DiscoverySource[] {
  return DISCOVERY_SOURCES.filter((s) => s.kinds.includes(kind))
}
