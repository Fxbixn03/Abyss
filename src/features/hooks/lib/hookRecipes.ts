/**
 * Curated hook starters for the Add dialog — analogous to the command / skill /
 * subagent scaffolds. Each seeds the form with a working event + matcher +
 * command (and timeout where it helps) so users don't have to know the
 * payload contract from scratch. Recipes whose event the active agent doesn't
 * support are filtered out by the form.
 */

import type { HookEvent } from '@/shared/types/hooks'

export interface HookRecipe {
  id: string
  label: string
  /** lucide icon name. */
  icon: string
  description: string
  event: HookEvent
  matcher: string
  command: string
  timeout?: number
}

export const HOOK_RECIPES: HookRecipe[] = [
  {
    id: 'blank',
    label: 'Blank',
    icon: 'square-slash',
    description: 'Start from an empty hook.',
    event: 'PreToolUse',
    matcher: '',
    command: '',
  },
  {
    id: 'format-on-edit',
    label: 'Format on edit',
    icon: 'sparkles',
    description: 'Run a formatter on each file the agent edits or writes.',
    event: 'PostToolUse',
    matcher: 'Edit|Write|MultiEdit',
    command:
      "jq -r '.tool_input.file_path // empty' | xargs -r npx prettier --write",
    timeout: 30,
  },
  {
    id: 'block-env-reads',
    label: 'Block .env reads',
    icon: 'shield-alert',
    description: 'Deny the agent reading secret files like .env.',
    event: 'PreToolUse',
    matcher: 'Read',
    command:
      'jq -e \'.tool_input.file_path | test("(^|/)\\\\.env")\' >/dev/null && { echo "Reading .env files is blocked." >&2; exit 2; } || exit 0',
  },
  {
    id: 'tests-on-stop',
    label: 'Run tests on stop',
    icon: 'clipboard-check',
    description: 'Run the test suite when the agent finishes responding.',
    event: 'Stop',
    matcher: '',
    command: 'npm test --silent',
    timeout: 120,
  },
  {
    id: 'desktop-notification',
    label: 'Desktop notification',
    icon: 'info',
    description: 'Pop a desktop notification when the agent needs you.',
    event: 'Notification',
    matcher: '',
    command:
      'jq -r \'.message // "Agent needs your attention"\' | xargs -I{} notify-send "Claude Code" "{}"',
  },
  {
    id: 'log-tool-calls',
    label: 'Log tool calls',
    icon: 'file-text',
    description: 'Append every tool call to a log file for auditing.',
    event: 'PreToolUse',
    matcher: '*',
    command:
      'jq -r \'"\\(now | todate) \\(.tool_name)"\' >> "$CLAUDE_PROJECT_DIR/.claude/tool-calls.log"',
  },
]
