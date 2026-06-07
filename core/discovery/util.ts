/**
 * Shared helpers for discovery providers. Node-only.
 *
 * - {@link fetchJson}: a timed JSON GET (throws on timeout / non-2xx).
 * - {@link createListCache}: memoizes a full provider list with a TTL, for
 *   registries that have no server-side search (we fetch once, then filter and
 *   paginate in memory).
 * - {@link paginate}: numeric-cursor slicing over an in-memory list.
 */

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Friendly message for a fetch failure (timeout vs. unreachable). */
export function describeFetchError(err: unknown): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return 'The registry took too long to respond.'
  }
  return 'Could not reach the registry. Check your connection.'
}

/** True if any of the (case-insensitive) haystacks contains the lowercase query. */
export function includesQuery(
  haystacks: (string | undefined)[],
  lowerQuery: string,
): boolean {
  return haystacks.some((h) => h?.toLowerCase().includes(lowerQuery))
}

/** Memoize a list fetch with a TTL; only successful fetches are cached. */
export function createListCache<T>(
  fetcher: () => Promise<T[]>,
  ttlMs: number,
): () => Promise<T[]> {
  let cache: { at: number; items: T[] } | null = null
  return async () => {
    if (cache && Date.now() - cache.at < ttlMs) return cache.items
    const items = await fetcher()
    cache = { at: Date.now(), items }
    return items
  }
}

/** Slice `items` with a string numeric cursor; returns the next cursor if more. */
export function paginate<T>(
  items: T[],
  cursor: string | undefined,
  limit: number,
): { page: T[]; nextCursor?: string } {
  const offset = cursor ? Number(cursor) || 0 : 0
  const end = offset + limit
  return {
    page: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : undefined,
  }
}
