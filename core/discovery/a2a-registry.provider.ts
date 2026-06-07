/**
 * Discovery provider for the A2A registry (https://a2aregistry.org). Node-only.
 *
 * The registry has no server-side search, so we fetch the full agent list once
 * (it is small, ~tens of agents), cache it, and filter + paginate in memory.
 * Each A2A agent card becomes a generic agent {@link DiscoveryResult}.
 */

import type {
  DiscoveryBadge,
  DiscoveryResult,
  DiscoverySearchRequest,
  DiscoverySearchResponse,
} from '@/shared/discovery/types'
import type { DiscoveredAgentSpec } from '@/shared/agents/discovery'
import type { DiscoveryProvider } from './provider'
import {
  createListCache,
  describeFetchError,
  fetchJson,
  includesQuery,
  paginate,
} from './util'

const API = 'https://a2aregistry.org/api/agents'
const TTL_MS = 30 * 60 * 1000
const DEFAULT_LIMIT = 30

interface RawSkill {
  name?: string
}
interface RawAgent {
  name?: string
  description?: string
  url?: string
  homepage?: string | null
  documentationUrl?: string | null
  provider?: { organization?: string; url?: string } | null
  skills?: RawSkill[]
  id?: string
  hidden?: boolean
}
interface RawResponse {
  agents?: RawAgent[]
}

function toResult(a: RawAgent): DiscoveryResult<DiscoveredAgentSpec> {
  const name = a.name ?? 'Unnamed agent'
  const description = a.description?.trim() ?? ''
  const provider = a.provider?.organization ?? undefined
  const skills = (a.skills ?? [])
    .map((s) => s.name)
    .filter((n): n is string => Boolean(n))

  const spec: DiscoveredAgentSpec = {
    name,
    description,
    url: a.url ?? undefined,
    homepage: a.homepage ?? a.provider?.url ?? undefined,
    documentationUrl: a.documentationUrl ?? undefined,
    provider,
    skills,
    source: 'a2a',
  }

  const badges: DiscoveryBadge[] = [{ label: 'a2a' }]
  if (provider) badges.push({ label: provider })

  return {
    kind: 'agent',
    id: a.id ?? `a2a:${name}`,
    name,
    description,
    // Prefer a human-friendly page over the raw A2A endpoint for the link.
    url: a.homepage ?? a.documentationUrl ?? a.provider?.url ?? a.url,
    badges,
    installable: true,
    payload: spec,
  }
}

const getAll = createListCache<DiscoveryResult<DiscoveredAgentSpec>>(async () => {
  const data = await fetchJson<RawResponse>(API, { timeoutMs: 12_000 })
  return (data.agents ?? [])
    .filter((a) => a?.name && a.hidden !== true)
    .map(toResult)
}, TTL_MS)

async function search(
  req: DiscoverySearchRequest,
): Promise<DiscoverySearchResponse> {
  try {
    const all = await getAll()
    const q = req.query.trim().toLowerCase()
    const filtered = q
      ? all.filter((r) =>
          includesQuery(
            [
              r.name,
              r.description,
              r.payload.provider,
              ...(r.payload.skills ?? []),
            ],
            q,
          ),
        )
      : all
    const { page, nextCursor } = paginate(filtered, req.cursor, req.limit ?? DEFAULT_LIMIT)
    return { results: page, nextCursor }
  } catch (err) {
    return { results: [], error: describeFetchError(err) }
  }
}

export const a2aRegistryProvider: DiscoveryProvider = {
  id: 'a2a-registry',
  kinds: ['agent'],
  search,
}
