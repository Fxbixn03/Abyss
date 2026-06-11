/**
 * Read / write Claude Code's plugin & marketplace declarations in `settings.json`
 * (`extraKnownMarketplaces` + `enabledPlugins`). Node-only. Unknown keys in the
 * file are preserved on write. See:
 * https://code.claude.com/docs/en/plugin-marketplaces
 */

import path from 'node:path'
import type {
  MarketplaceSource,
  MarketplaceSourceType,
  PluginsConfig,
} from '@/shared/types/plugins'
import { readJsonFile, writeJsonFile } from './json-file'

interface PluginSettingsFile {
  extraKnownMarketplaces?: Record<string, { source?: unknown }>
  enabledPlugins?: Record<string, boolean>
  [key: string]: unknown
}

const SOURCE_TYPES: MarketplaceSourceType[] = [
  'github',
  'git',
  'directory',
  'file',
]

function settingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

function normalizeSource(raw: unknown): MarketplaceSource {
  if (!raw || typeof raw !== 'object') return { source: 'github' }
  const s = raw as Partial<MarketplaceSource>
  const type = SOURCE_TYPES.includes(s.source as MarketplaceSourceType)
    ? (s.source as MarketplaceSourceType)
    : 'github'
  return {
    source: type,
    ...(s.repo ? { repo: s.repo } : {}),
    ...(s.url ? { url: s.url } : {}),
    ...(s.path ? { path: s.path } : {}),
    ...(s.ref ? { ref: s.ref } : {}),
  }
}

/** Drop empty optional keys so the written JSON stays minimal. */
function cleanSource(src: MarketplaceSource): MarketplaceSource {
  return {
    source: src.source,
    ...(src.repo?.trim() ? { repo: src.repo.trim() } : {}),
    ...(src.url?.trim() ? { url: src.url.trim() } : {}),
    ...(src.path?.trim() ? { path: src.path.trim() } : {}),
    ...(src.ref?.trim() ? { ref: src.ref.trim() } : {}),
  }
}

export async function readPlugins(basePath: string): Promise<PluginsConfig> {
  const s = await readJsonFile<PluginSettingsFile>(settingsPath(basePath), {})
  const marketplaces = Object.entries(s.extraKnownMarketplaces ?? {}).map(
    ([name, value]) => ({ name, source: normalizeSource(value?.source) }),
  )
  const plugins = Object.entries(s.enabledPlugins ?? {}).map(
    ([key, enabled]) => ({ key, enabled: Boolean(enabled) }),
  )
  return { marketplaces, plugins }
}

export async function writePlugins(
  basePath: string,
  config: PluginsConfig,
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const s = await readJsonFile<PluginSettingsFile>(p, {})

  if (config.marketplaces.length > 0) {
    s.extraKnownMarketplaces = Object.fromEntries(
      config.marketplaces
        .filter((m) => m.name.trim() !== '')
        .map((m) => [m.name.trim(), { source: cleanSource(m.source) }]),
    )
  } else {
    delete s.extraKnownMarketplaces
  }

  if (config.plugins.length > 0) {
    s.enabledPlugins = Object.fromEntries(
      config.plugins
        .filter((pl) => pl.key.trim() !== '')
        .map((pl) => [pl.key.trim(), pl.enabled]),
    )
  } else {
    delete s.enabledPlugins
  }

  await writeJsonFile(p, s)
  return { success: true, path: p }
}
