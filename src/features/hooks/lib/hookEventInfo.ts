/**
 * Per-event reference for lifecycle hooks: a one-line "when it fires", plus the
 * I/O contract (what the hook receives on stdin, what it can return, and the
 * exit-code semantics). Most users don't know the payload contract, so the form
 * surfaces this inline. Text mirrors Claude Code's hooks reference; the three
 * tool/stop events that Gemini and Cursor also expose share the same shape.
 */

import type { HookEvent } from '@/shared/types/hooks'

export interface HookEventInfo {
  /** When in the agent lifecycle the hook runs. */
  when: string
  /** What the hook gets on stdin (JSON payload shape, key fields). */
  receives: string
  /** What returning JSON on stdout can influence, if anything. */
  canReturn: string
}

/**
 * Exit-code semantics shared by every Claude hook:
 * 0 = success (stdout shown to user in transcript mode), 2 = blocking error
 * (stderr is fed back to the agent), other = non-blocking error (stderr shown,
 * execution continues).
 */
export const HOOK_EXIT_CODES =
  'Exit 0 = ok · exit 2 = block (stderr goes back to the agent) · other = non-blocking error.'

export const HOOK_EVENT_INFO: Record<HookEvent, HookEventInfo> = {
  PreToolUse: {
    when: 'Before a tool call runs — can block the call or auto-approve it.',
    receives: 'JSON: session_id, tool_name, tool_input, cwd.',
    canReturn:
      'permissionDecision (allow/deny/ask) + reason, or exit 2 to block.',
  },
  PostToolUse: {
    when: 'Right after a tool call completes.',
    receives: 'JSON: tool_name, tool_input, tool_response, cwd.',
    canReturn: 'A reason fed back to the agent; cannot undo the call.',
  },
  UserPromptSubmit: {
    when: 'When you submit a prompt, before the agent sees it.',
    receives: 'JSON: prompt, session_id, cwd.',
    canReturn:
      'Extra context on stdout (added to the prompt), or exit 2 to block it.',
  },
  Notification: {
    when: 'When the agent sends a notification (e.g. needs permission/input).',
    receives: 'JSON: message, session_id, cwd.',
    canReturn: 'Nothing — fire-and-forget (e.g. a desktop notification).',
  },
  Stop: {
    when: 'When the agent finishes responding and is about to stop.',
    receives: 'JSON: session_id, stop_hook_active, cwd.',
    canReturn: 'Exit 2 to make the agent keep going instead of stopping.',
  },
  SubagentStop: {
    when: 'When a subagent (Task tool) finishes.',
    receives: 'JSON: session_id, stop_hook_active, cwd.',
    canReturn: 'Exit 2 to keep the subagent going.',
  },
  PreCompact: {
    when: 'Before the context window is compacted (manual or auto).',
    receives: 'JSON: trigger (manual/auto), custom_instructions, cwd.',
    canReturn: 'Nothing actionable — observe/log only.',
  },
  SessionStart: {
    when: 'When a session starts or resumes.',
    receives: 'JSON: source (startup/resume/clear), session_id, cwd.',
    canReturn: 'Context on stdout, added to the session start.',
  },
  SessionEnd: {
    when: 'When a session ends.',
    receives: 'JSON: reason, session_id, cwd.',
    canReturn: 'Nothing — cleanup/logging only.',
  },
  beforeSubmitPrompt: {
    when: 'Cursor — before a submitted prompt reaches the model.',
    receives: 'JSON: the prompt and session context.',
    canReturn: 'Block or augment the prompt before it is sent.',
  },
}
