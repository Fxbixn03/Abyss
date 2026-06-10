/**
 * Portable hooks bundle — a small JSON file users can export and re-import (or
 * share). Mirrors the flat {@link HookEntry} list of one agent; ids are dropped
 * on export (they're re-assigned on import) and the `disabled` flag is kept so a
 * parked hook round-trips.
 */

import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { HOOK_EVENTS } from '@/shared/types/hooks'

export const HOOKS_BUNDLE_SCHEMA = 'abyss-hooks/v1'

export interface HooksBundle {
  $schema: typeof HOOKS_BUNDLE_SCHEMA
  agentId: string
  exportedAt: string
  hooks: Array<Omit<HookEntry, 'id'>>
}

const VALID_EVENTS = new Set<string>([...HOOK_EVENTS, 'beforeSubmitPrompt'])

export function buildHooksBundle(
  agentId: string,
  entries: HookEntry[],
): HooksBundle {
  return {
    $schema: HOOKS_BUNDLE_SCHEMA,
    agentId,
    exportedAt: new Date().toISOString(),
    hooks: entries.map(({ event, matcher, command, timeout, disabled }) => ({
      event,
      matcher,
      command,
      ...(timeout !== undefined ? { timeout } : {}),
      ...(disabled ? { disabled: true } : {}),
    })),
  }
}

/**
 * Parse a bundle file into hook entries with fresh ids. Throws on a malformed or
 * non-hooks file; silently skips entries with an unknown event or no command.
 */
export function parseHooksBundle(raw: string): HookEntry[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as HooksBundle).$schema !== HOOKS_BUNDLE_SCHEMA ||
    !Array.isArray((data as HooksBundle).hooks)
  ) {
    throw new Error('Not an Abyss hooks bundle.')
  }

  const out: HookEntry[] = []
  let counter = 0
  for (const h of (data as HooksBundle).hooks) {
    if (!h || typeof h.command !== 'string' || h.command.trim() === '') continue
    if (typeof h.event !== 'string' || !VALID_EVENTS.has(h.event)) continue
    out.push({
      id: `import-${counter++}`,
      event: h.event as HookEvent,
      matcher: typeof h.matcher === 'string' ? h.matcher : '',
      command: h.command,
      ...(typeof h.timeout === 'number' ? { timeout: h.timeout } : {}),
      ...(h.disabled ? { disabled: true } : {}),
    })
  }
  if (out.length === 0) throw new Error('No valid hooks in the file.')
  return out
}
