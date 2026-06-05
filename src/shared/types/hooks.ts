/**
 * Lifecycle hooks, as stored in Claude Code's `settings.json` under `hooks`:
 *   event -> [{ matcher, hooks: [{ type: 'command', command }] }]
 *
 * Abyss flattens this to one {@link HookEntry} per command for editing, then
 * re-groups on write.
 */

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionStart',
  'SessionEnd',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

export interface HookEntry {
  /** Stable local id for list rendering. */
  id: string
  event: HookEvent
  /** Tool matcher (e.g. 'Bash', 'Edit|Write', '*'). May be empty for events
   *  that don't use a matcher. */
  matcher: string
  /** Shell command to run. */
  command: string
}

/** Events where a tool matcher is meaningful. */
export const MATCHER_EVENTS: ReadonlySet<HookEvent> = new Set([
  'PreToolUse',
  'PostToolUse',
])
