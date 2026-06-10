/**
 * Read / write lifecycle hooks. Node-only.
 *
 * Claude groups them in `settings.json`:
 *   event -> [{ matcher, hooks: [{ type, command }] }]
 * Gemini (`<base>/hooks/hooks.json`) and Cursor (`<base>/hooks.json`) use a flat
 * format (see `core/hooks-flat`). The public {@link readHooks} / {@link writeHooks}
 * dispatch on the agent id; in every case Abyss works with a flat
 * {@link HookEntry} per command and preserves all other config keys.
 */

import path from 'node:path'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { readJsonFile, writeJsonFile } from './json-file'
import { readFlatHooks, writeFlatHooks } from './hooks-flat'

interface RawHook {
  type: string
  command: string
  /** Optional per-hook timeout in seconds (Claude-specific). */
  timeout?: number
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

/** Gemini keeps hooks in a dedicated `hooks/hooks.json`. */
function geminiHooksPath(basePath: string): string {
  return path.join(basePath, 'hooks', 'hooks.json')
}

/** Cursor keeps hooks in a top-level `hooks.json`. */
function cursorHooksPath(basePath: string): string {
  return path.join(basePath, 'hooks.json')
}

/** Read hooks for an agent, dispatching to the right on-disk format. */
export function readHooks(
  agentId: string,
  basePath: string,
): Promise<HookEntry[]> {
  if (agentId === 'gemini') return readFlatHooks(geminiHooksPath(basePath))
  if (agentId === 'cursor') return readFlatHooks(cursorHooksPath(basePath))
  return readClaudeHooks(basePath)
}

/** Write hooks for an agent, dispatching to the right on-disk format. */
export function writeHooks(
  agentId: string,
  basePath: string,
  entries: HookEntry[],
): Promise<{ success: boolean; path: string }> {
  if (agentId === 'gemini') {
    return writeFlatHooks(geminiHooksPath(basePath), entries)
  }
  if (agentId === 'cursor') {
    return writeFlatHooks(cursorHooksPath(basePath), entries)
  }
  return writeClaudeHooks(basePath, entries)
}

async function readClaudeHooks(basePath: string): Promise<HookEntry[]> {
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
            ...(typeof hook.timeout === 'number'
              ? { timeout: hook.timeout }
              : {}),
          })
        }
      }
    }
  }
  return out
}

async function writeClaudeHooks(
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
    const rawHook: RawHook = { type: 'command', command: entry.command }
    if (typeof entry.timeout === 'number' && entry.timeout > 0) {
      rawHook.timeout = entry.timeout
    }
    group.hooks?.push(rawHook)
  }

  if (Object.keys(grouped).length === 0) {
    delete settings.hooks
  } else {
    settings.hooks = grouped
  }

  await writeJsonFile(p, settings)
  return { success: true, path: p }
}
