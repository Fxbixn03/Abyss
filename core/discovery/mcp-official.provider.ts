/**
 * Discovery provider for the official MCP registry
 * (https://registry.modelcontextprotocol.io). Node-only.
 *
 * Fetches `/v0/servers` (optionally filtered by `search`), de-duplicates to the
 * latest version per server name, and normalizes each entry into a generic
 * {@link DiscoveryResult} whose payload is a runnable {@link McpInstallSpec}
 * (command/args/env for stdio packages, or a URL for remote-only servers).
 *
 * Never throws: network/parse failures resolve to `{ results: [], error }`.
 */

import type {
  DiscoveryBadge,
  DiscoveryResult,
  DiscoverySearchRequest,
  DiscoverySearchResponse,
} from '@/shared/discovery/types'
import type { DiscoveryProvider } from './provider'
import type { McpInstallSpec } from '@/shared/mcp/discovery'

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io'
const TIMEOUT_MS = 10_000
const DEFAULT_LIMIT = 30
const RUNTIME_PRIORITY = ['npx', 'uvx', 'dnx', 'docker']

interface RawArgument {
  type?: 'positional' | 'named'
  name?: string
  value?: string
  valueHint?: string
}
interface RawEnvVar {
  name: string
  description?: string
  isRequired?: boolean
  isSecret?: boolean
  value?: string
}
interface RawPackage {
  registryType?: string
  identifier?: string
  version?: string
  runtimeHint?: string
  transport?: { type?: string }
  runtimeArguments?: RawArgument[]
  packageArguments?: RawArgument[]
  environmentVariables?: RawEnvVar[]
}
interface RawRemote {
  type?: string
  url?: string
}
interface RawServer {
  name: string
  title?: string
  description?: string
  version?: string
  repository?: { url?: string }
  packages?: RawPackage[]
  remotes?: RawRemote[]
}
interface RawItem {
  server: RawServer
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: { isLatest?: boolean }
  }
}
interface RawResponse {
  servers?: RawItem[]
  metadata?: { nextCursor?: string }
}

const OFFICIAL_META = 'io.modelcontextprotocol.registry/official'

/** Slug from a reverse-DNS registry name: `com.acme/slack` → `slack`. */
function suggestedName(name: string): string {
  const tail = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
  const slug = tail
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'server'
}

function defaultRuntime(registryType?: string): string | undefined {
  switch (registryType) {
    case 'npm':
      return 'npx'
    case 'pypi':
      return 'uvx'
    case 'nuget':
      return 'dnx'
    case 'oci':
      return 'docker'
    default:
      return undefined
  }
}

function effectiveRuntime(p: RawPackage): string | undefined {
  return p.runtimeHint ?? defaultRuntime(p.registryType)
}

function runtimeRank(runtime: string | undefined): number {
  const i = RUNTIME_PRIORITY.indexOf(runtime ?? '')
  return i === -1 ? RUNTIME_PRIORITY.length : i
}

/** Prefer stdio packages with a known runtime, highest-priority runtime first. */
function pickPackage(packages: RawPackage[]): RawPackage | undefined {
  const stdio = packages.filter(
    (p) => (p.transport?.type ?? 'stdio') === 'stdio' && p.identifier,
  )
  return [...stdio].sort(
    (a, b) => runtimeRank(effectiveRuntime(a)) - runtimeRank(effectiveRuntime(b)),
  )[0]
}

/** Flatten registry argument objects into a plain argv list. */
function flattenArgs(args?: RawArgument[]): string[] {
  const out: string[] = []
  for (const a of args ?? []) {
    if (a.type === 'named') {
      if (a.name) out.push(a.name)
      if (a.value !== undefined) out.push(a.value)
    } else if (a.value !== undefined) {
      out.push(a.value)
    }
  }
  return out
}

/** Build command/args for a stdio package; empty when the runtime is unknown. */
function buildStdio(p: RawPackage): { command?: string; args?: string[] } {
  const runtime = effectiveRuntime(p)
  const identifier = p.identifier
  if (!runtime || !identifier) return {}
  const runtimeArgs = flattenArgs(p.runtimeArguments)
  const packageArgs = flattenArgs(p.packageArguments)

  if (runtime === 'npx') {
    const args = [...runtimeArgs]
    if (!args.includes('-y')) args.unshift('-y')
    args.push(identifier, ...packageArgs)
    return { command: 'npx', args }
  }
  if (runtime === 'docker') {
    const envFlags = (p.environmentVariables ?? []).flatMap((e) => [
      '-e',
      e.name,
    ])
    return {
      command: 'docker',
      args: ['run', '-i', '--rm', ...envFlags, identifier, ...packageArgs],
    }
  }
  // uvx / dnx and any other simple runner share the same shape.
  return { command: runtime, args: [...runtimeArgs, identifier, ...packageArgs] }
}

function remoteTransport(type?: string): 'http' | 'sse' {
  return type === 'sse' ? 'sse' : 'http'
}

function toResult(server: RawServer): DiscoveryResult<McpInstallSpec> {
  const pkg = pickPackage(server.packages ?? [])
  const built = pkg ? buildStdio(pkg) : {}
  const remote = (server.remotes ?? []).find((r) => r.url)

  let spec: McpInstallSpec
  let source: string
  let installable = true
  let requiredEnv: string[] = []

  if (pkg && built.command) {
    spec = {
      transport: 'stdio',
      command: built.command,
      args: built.args,
      env: (pkg.environmentVariables ?? []).map((e) => ({
        name: e.name,
        default: e.value,
      })),
    }
    source = pkg.registryType ?? 'package'
    requiredEnv = (pkg.environmentVariables ?? [])
      .filter((e) => e.isRequired)
      .map((e) => e.name)
  } else if (remote?.url) {
    spec = { transport: remoteTransport(remote.type), url: remote.url, env: [] }
    source = 'remote'
  } else {
    spec = { transport: 'stdio', env: [] }
    source = pkg?.registryType ?? 'unknown'
    installable = false
  }

  const badges: DiscoveryBadge[] = [
    { label: source },
    ...requiredEnv.map((name) => ({ label: name, variant: 'warning' as const })),
  ]

  return {
    kind: 'mcp',
    id: `${server.name}@${server.version ?? ''}`,
    name: suggestedName(server.name),
    description: server.description?.trim() ?? '',
    url: server.repository?.url,
    badges,
    installable,
    payload: spec,
  }
}

/** Keep one entry per server name, preferring the one flagged `isLatest`. */
function dedupeLatest(items: RawItem[]): RawServer[] {
  const byName = new Map<string, { server: RawServer; isLatest: boolean }>()
  for (const it of items) {
    const server = it.server
    if (!server?.name) continue
    const isLatest = it._meta?.[OFFICIAL_META]?.isLatest === true
    const existing = byName.get(server.name)
    if (!existing || (isLatest && !existing.isLatest)) {
      byName.set(server.name, { server, isLatest })
    }
  }
  return [...byName.values()].map((v) => v.server)
}

async function search(
  req: DiscoverySearchRequest,
): Promise<DiscoverySearchResponse> {
  const limit = Math.min(Math.max(req.limit ?? DEFAULT_LIMIT, 1), 100)
  const params = new URLSearchParams()
  const q = req.query.trim()
  if (q) params.set('search', q)
  params.set('limit', String(limit))
  if (req.cursor) params.set('cursor', req.cursor)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${REGISTRY_BASE}/v0/servers?${params.toString()}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      return { results: [], error: `Registry returned HTTP ${res.status}.` }
    }
    const data = (await res.json()) as RawResponse
    return {
      results: dedupeLatest(data.servers ?? []).map(toResult),
      nextCursor: data.metadata?.nextCursor,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return {
      results: [],
      error: aborted
        ? 'The registry took too long to respond.'
        : 'Could not reach the registry. Check your connection.',
    }
  } finally {
    clearTimeout(timer)
  }
}

export const mcpOfficialProvider: DiscoveryProvider = {
  id: 'mcp-official',
  kinds: ['mcp'],
  search,
}
