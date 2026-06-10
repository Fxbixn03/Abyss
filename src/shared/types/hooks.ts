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

/** All hook events across agents. Cursor adds `beforeSubmitPrompt`. */
export type HookEvent = (typeof HOOK_EVENTS)[number] | 'beforeSubmitPrompt'

/**
 * Which lifecycle events an agent exposes. Claude has the full grouped set;
 * Gemini's flat `hooks.json` supports the three core tool/stop events; Cursor
 * additionally fires `beforeSubmitPrompt`.
 */
export function hookEventsFor(agentId: string): readonly HookEvent[] {
  if (agentId === 'gemini') return ['PreToolUse', 'PostToolUse', 'Stop']
  if (agentId === 'cursor') {
    return ['PreToolUse', 'PostToolUse', 'Stop', 'beforeSubmitPrompt']
  }
  return HOOK_EVENTS
}

export interface HookEntry {
  /** Stable local id for list rendering. */
  id: string
  event: HookEvent
  /** Tool matcher (e.g. 'Bash', 'Edit|Write', '*'). May be empty for events
   *  that don't use a matcher. */
  matcher: string
  /** Shell command to run. */
  command: string
  /**
   * Optional per-hook timeout in seconds. Claude-only — Claude stores it next to
   * the command; Gemini/Cursor's flat format has no slot for it, so it's
   * undefined there and the UI hides the field for those agents.
   */
  timeout?: number
}

/** Events where a tool matcher is meaningful. */
export const MATCHER_EVENTS: ReadonlySet<HookEvent> = new Set([
  'PreToolUse',
  'PostToolUse',
])

/** Whether the given agent's on-disk format can store a per-hook timeout. */
export function supportsHookTimeout(agentId: string): boolean {
  return agentId !== 'gemini' && agentId !== 'cursor'
}
