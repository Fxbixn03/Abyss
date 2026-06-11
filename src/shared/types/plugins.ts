/**
 * Claude Code plugin & marketplace declarations. These live in `settings.json`
 * (any scope) and tell Claude Code which marketplaces to trust and which plugins
 * to enable; the actual clone/cache lives under `~/.claude/plugins`. Abyss only
 * edits the documented, scope-aware declarations. See:
 * https://code.claude.com/docs/en/plugin-marketplaces
 */

export type MarketplaceSourceType = 'github' | 'git' | 'directory' | 'file'

export interface MarketplaceSource {
  source: MarketplaceSourceType
  /** github: "owner/repo". */
  repo?: string
  /** git: clone URL; also used for a remote marketplace.json URL. */
  url?: string
  /** directory / file: local path. */
  path?: string
  /** Optional branch or tag (git / github). */
  ref?: string
}

export interface MarketplaceEntry {
  /** Key under `extraKnownMarketplaces`. */
  name: string
  source: MarketplaceSource
}

export interface PluginEntry {
  /** `"<plugin>@<marketplace>"`, the key under `enabledPlugins`. */
  key: string
  enabled: boolean
}

export interface PluginsConfig {
  marketplaces: MarketplaceEntry[]
  plugins: PluginEntry[]
}

export const EMPTY_PLUGINS_CONFIG: PluginsConfig = {
  marketplaces: [],
  plugins: [],
}
