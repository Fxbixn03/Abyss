/**
 * Read / write the flat lifecycle-hooks format used by Gemini CLI
 * (`<base>/hooks/hooks.json`) and Cursor (`<base>/hooks.json`):
 *
 *   { "hooks": [ { "event", "tool"?, "command" } ] }
 *
 * Abyss's {@link HookEntry} maps `matcher` <-> the flat `tool` field. Every other
 * top-level key (and any unknown per-hook fields) is preserved on write so we
 * never clobber the live config.
 *
 * v1 limit: a hook's optional `name` / `description` are not surfaced in the UI
 * and are dropped on round-trip — only `event` / `tool` / `command` survive.
 * Node-only.
 */

import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { readJsonFile, writeJsonFile } from './json-file'

interface RawFlatHook {
  event?: string
  tool?: string
  command?: string
  [key: string]: unknown
}

interface FlatHooksFile {
  hooks?: RawFlatHook[]
  [key: string]: unknown
}

export async function readFlatHooks(file: string): Promise<HookEntry[]> {
  const data = await readJsonFile<FlatHooksFile>(file, {})
  const out: HookEntry[] = []
  let counter = 0
  for (const hook of data.hooks ?? []) {
    if (!hook.event || typeof hook.command !== 'string') continue
    out.push({
      id: `${hook.event}-${counter++}`,
      event: hook.event as HookEvent,
      matcher: typeof hook.tool === 'string' ? hook.tool : '',
      command: hook.command,
    })
  }
  return out
}

export async function writeFlatHooks(
  file: string,
  entries: HookEntry[],
): Promise<{ success: boolean; path: string }> {
  // Re-read right before writing to keep sibling keys and shrink the
  // lost-update window.
  const data = await readJsonFile<FlatHooksFile>(file, {})

  const hooks: RawFlatHook[] = entries.map((entry) => {
    const raw: RawFlatHook = { event: entry.event }
    if (entry.matcher) raw.tool = entry.matcher
    raw.command = entry.command
    return raw
  })

  if (hooks.length === 0) delete data.hooks
  else data.hooks = hooks

  await writeJsonFile(file, data)
  return { success: true, path: file }
}
