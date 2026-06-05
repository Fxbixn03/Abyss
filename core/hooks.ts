/**
 * Read / write lifecycle hooks in `settings.json`. Node-only.
 *
 * On disk:   event -> [{ matcher, hooks: [{ type, command }] }]
 * In Abyss:  a flat HookEntry per command. We re-group on write and preserve
 *            all other settings keys.
 */

import path from 'node:path'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { readJsonFile, writeJsonFile } from './json-file'

interface RawHook {
  type: string
  command: string
}

interface RawMatcherGroup {
  matcher?: string
  hooks?: RawHook[]
}

interface SettingsWithHooks {
  hooks?: Record<string, RawMatcherGroup[]>
  [key: string]: unknown
}

function settingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

export async function readHooks(basePath: string): Promise<HookEntry[]> {
  const settings = await readJsonFile<SettingsWithHooks>(
    settingsPath(basePath),
    {},
  )
  const hooks = settings.hooks ?? {}
  const out: HookEntry[] = []
  let counter = 0

  for (const event of Object.keys(hooks)) {
    for (const group of hooks[event] ?? []) {
      const matcher = group.matcher ?? ''
      for (const hook of group.hooks ?? []) {
        if (hook.type === 'command') {
          out.push({
            id: `${event}-${counter++}`,
            event: event as HookEvent,
            matcher,
            command: hook.command,
          })
        }
      }
    }
  }
  return out
}

export async function writeHooks(
  basePath: string,
  entries: HookEntry[],
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const settings = await readJsonFile<SettingsWithHooks>(p, {})

  const grouped: Record<string, RawMatcherGroup[]> = {}
  for (const entry of entries) {
    grouped[entry.event] ??= []
    let group = grouped[entry.event].find(
      (g) => (g.matcher ?? '') === entry.matcher,
    )
    if (!group) {
      group = { matcher: entry.matcher, hooks: [] }
      grouped[entry.event].push(group)
    }
    group.hooks?.push({ type: 'command', command: entry.command })
  }

  if (Object.keys(grouped).length === 0) {
    delete settings.hooks
  } else {
    settings.hooks = grouped
  }

  await writeJsonFile(p, settings)
  return { success: true, path: p }
}
