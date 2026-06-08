/**
 * Discovery provider for aiagentsdirectory.com. Node-only.
 *
 * Its API returns the entire directory as one (large, ~4–5 MB) JSON array with
 * no server-side search, so we fetch it once, cache it with a generous TTL, and
 * filter + paginate in memory. Entries are product listings, normalized into
 * generic agent {@link DiscoveryResult}s.
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

const API = 'https://aiagentsdirectory.com/api/agents'
const SITE = 'https://aiagentsdirectory.com'
const TTL_MS = 30 * 60 * 1000
const DEFAULT_LIMIT = 30

interface RawAgent {
  _id?: string
  slug?: string
  name?: string
  website?: string
  shortDescription?: string
  longDescription?: string
  category?: string
  pricingModel?: string
  githubUrl?: string
}

function toResult(a: RawAgent): DiscoveryResult<DiscoveredAgentSpec> {
  const name = a.name ?? 'Unnamed agent'
  const description = (a.shortDescription || a.longDescription || '').trim()

  const spec: DiscoveredAgentSpec = {
    name,
    description,
    url: a.website ?? undefined,
    homepage: a.website ?? undefined,
    documentationUrl: a.githubUrl ?? undefined,
    category: a.category ?? undefined,
    source: 'directory',
  }

  const badges: DiscoveryBadge[] = []
  if (a.category) badges.push({ label: a.category })
  if (a.pricingModel) badges.push({ label: a.pricingModel })

  return {
    kind: 'agent',
    id: a._id ?? a.slug ?? `directory:${name}`,
    name,
    description,
    url: a.website ?? (a.slug ? `${SITE}/agent/${a.slug}` : SITE),
    badges,
    installable: true,
    payload: spec,
  }
}

const getAll = createListCache<DiscoveryResult<DiscoveredAgentSpec>>(
  async (signal) => {
    const data = await fetchJson<RawAgent[]>(API, { timeoutMs: 20_000, signal })
    return (Array.isArray(data) ? data : [])
      .filter((a) => a?.name)
      .map(toResult)
  },
  TTL_MS,
)

async function search(
  req: DiscoverySearchRequest,
  signal?: AbortSignal,
): Promise<DiscoverySearchResponse> {
  try {
    const all = await getAll(signal)
    const q = req.query.trim().toLowerCase()
    const filtered = q
      ? all.filter((r) =>
          includesQuery([r.name, r.description, r.payload.category], q),
        )
      : all
    const { page, nextCursor } = paginate(filtered, req.cursor, req.limit ?? DEFAULT_LIMIT)
    return { results: page, nextCursor }
  } catch (err) {
    return { results: [], error: describeFetchError(err) }
  }
}

export const aiAgentsDirectoryProvider: DiscoveryProvider = {
  id: 'ai-agents-directory',
  kinds: ['agent'],
  search,
}
