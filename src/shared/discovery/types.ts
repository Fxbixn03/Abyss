/**
 * Generic, kind-agnostic discovery layer. Today it powers MCP-server discovery;
 * the same shapes are meant to back skills / agents / commands / themes later.
 *
 * A {@link DiscoverySource} describes *where* results come from (a searchable
 * API or a website to browse). A {@link DiscoveryProvider} (in `core/`) turns a
 * query into {@link DiscoveryResult}s whose `payload` carries the kind-specific
 * install data the renderer needs to build the concrete artifact.
 */

/** What is being discovered. Open-ended on purpose — add kinds as features grow. */
export type DiscoveryKind =
  | 'mcp'
  | 'skill'
  | 'agent'
  | 'command'
  | 'theme'
  | (string & {})

/** `search` = queryable in-app API; `website` = open the source externally. */
export type DiscoverySourceMode = 'search' | 'website'

export interface DiscoverySource {
  id: string
  label: string
  /** Which kinds this source can provide. */
  kinds: DiscoveryKind[]
  mode: DiscoverySourceMode
  /** Homepage. For `website` sources this is what gets opened externally. */
  url: string
  description: string
  /** For `mode: 'search'` — the core provider id that backs this source. */
  providerId?: string
}

export interface DiscoveryBadge {
  label: string
  variant?: 'default' | 'warning'
}

/**
 * One discovered item. `payload` is kind-specific (e.g. MCP install spec) and
 * is interpreted by the consuming feature, not the generic shell.
 */
export interface DiscoveryResult<T = unknown> {
  kind: DiscoveryKind
  /** Stable id for list rendering (registry name + version is fine). */
  id: string
  name: string
  description: string
  /** Repo/homepage to open externally, if any. */
  url?: string
  badges?: DiscoveryBadge[]
  /** false = info only (no one-click add possible). */
  installable: boolean
  payload: T
}

export interface DiscoverySearchRequest {
  kind: DiscoveryKind
  sourceId: string
  query: string
  cursor?: string
  limit?: number
}

export interface DiscoverySearchResponse {
  results: DiscoveryResult[]
  nextCursor?: string
  error?: string
}
