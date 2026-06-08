/**
 * Core-side discovery provider registry. Node-only.
 *
 * A provider knows how to search one source (e.g. the official MCP registry) for
 * one or more {@link DiscoveryKind}s. Providers register themselves; the IPC
 * handler calls {@link runDiscoverySearch} with a request carrying the chosen
 * `sourceId`. New discoverable areas plug in by registering a new provider.
 */

import type {
  DiscoveryKind,
  DiscoverySearchRequest,
  DiscoverySearchResponse,
} from '@/shared/discovery/types'

export interface DiscoveryProvider {
  /** Matches `DiscoverySource.providerId`. */
  id: string
  kinds: DiscoveryKind[]
  search: (
    req: DiscoverySearchRequest,
    signal?: AbortSignal,
  ) => Promise<DiscoverySearchResponse>
}

const providers = new Map<string, DiscoveryProvider>()

export function registerProvider(provider: DiscoveryProvider): void {
  providers.set(provider.id, provider)
}

/**
 * Route a search to the provider behind `req.sourceId`. Providers must never
 * throw — but we still guard here so an unknown source returns a clean error.
 */
export async function runDiscoverySearch(
  req: DiscoverySearchRequest,
  signal?: AbortSignal,
): Promise<DiscoverySearchResponse> {
  const provider = providers.get(req.sourceId)
  if (!provider || !provider.kinds.includes(req.kind)) {
    return { results: [], error: `Unknown discovery source: ${req.sourceId}` }
  }
  try {
    return await provider.search(req, signal)
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : 'Discovery search failed.',
    }
  }
}
