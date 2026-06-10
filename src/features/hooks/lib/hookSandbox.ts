/**
 * Build a runnable sandbox snippet for a hook. Hooks receive their event payload
 * as JSON on stdin, so testing the raw command alone (with no stdin) rarely does
 * anything useful. Here we pipe a representative sample payload into the command
 * so jq/grep-style hooks actually exercise their logic in the sandbox.
 */

import type { HookEntry, HookEvent } from '@/shared/types/hooks'

/** A representative stdin payload per event, matching the documented shape. */
function samplePayload(
  event: HookEvent,
  matcher: string,
): Record<string, unknown> {
  const base = { session_id: 'sandbox-test', cwd: '.' }
  const tool = matcher.split('|')[0].replace(/[^A-Za-z]/g, '') || 'Bash'
  switch (event) {
    case 'PreToolUse':
      return {
        ...base,
        tool_name: tool,
        tool_input: { command: 'echo hi', file_path: 'src/example.ts' },
      }
    case 'PostToolUse':
      return {
        ...base,
        tool_name: tool,
        tool_input: { file_path: 'src/example.ts' },
        tool_response: { success: true },
      }
    case 'UserPromptSubmit':
      return { ...base, prompt: 'Sample prompt from the sandbox.' }
    case 'Notification':
      return { ...base, message: 'Sample notification.' }
    case 'Stop':
    case 'SubagentStop':
      return { ...base, stop_hook_active: false }
    case 'PreCompact':
      return { ...base, trigger: 'manual', custom_instructions: '' }
    case 'SessionStart':
      return { ...base, source: 'startup' }
    case 'SessionEnd':
      return { ...base, reason: 'exit' }
    default:
      return base
  }
}

/**
 * Wrap a hook command so it runs against a sample stdin payload. Single quotes
 * in the JSON are escaped for the surrounding single-quoted echo.
 */
export function buildSandboxSnippet(entry: HookEntry): string {
  const json = JSON.stringify(samplePayload(entry.event, entry.matcher))
  const safe = json.replace(/'/g, `'\\''`)
  return `echo '${safe}' | ${entry.command.trim()}`
}
