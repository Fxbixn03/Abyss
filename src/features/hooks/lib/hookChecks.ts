/**
 * Pure, renderer-safe checks for a single hook entry, feeding the shared
 * ValidationList. These turn "runs silently into the void" mistakes into visible
 * warnings: a matcher on an event that ignores it, an invalid matcher regex, a
 * destructive command, an empty command. Script-file *existence* needs the disk,
 * so it's checked separately via IPC in the page — here we only detect that a
 * command references a script (see {@link extractScriptPath}).
 */

import type { ValidationIssue } from '@/shared/types/agent'
import type { HookEntry, HookEvent } from '@/shared/types/hooks'
import { MATCHER_EVENTS } from '@/shared/types/hooks'

/** Destructive shell snippets worth a heads-up before they run on every event. */
const DESTRUCTIVE_RE =
  /\brm\s+(-[A-Za-z]*\s+)*-[A-Za-z]*[rf][A-Za-z]*\b|\bgit\s+(reset\s+--hard|clean\s+-[A-Za-z]*f|push\s+--force)\b|\bmkfs\b|\bdd\s+if=|:\(\)\s*\{|\bshutdown\b|\breboot\b/

/** File extensions we treat as "this command points at a script file". */
const SCRIPT_EXT_RE = /\.(sh|bash|zsh|py|js|cjs|mjs|ts|rb|pl|ps1)\b/

/**
 * Pull the first script-file path out of a command, if it references one
 * (e.g. `$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh --flag`). Returns the raw
 * token (env vars unexpanded) or null. Used to offer "Open script" and to check
 * the file actually exists.
 */
export function extractScriptPath(command: string): string | null {
  for (const rawToken of command.split(/\s+/)) {
    const token = rawToken.replace(/^["']|["']$/g, '')
    if (!token) continue
    if (!SCRIPT_EXT_RE.test(token)) continue
    // Must look like a path, not a bare `node.js`-style word.
    if (token.includes('/') || token.includes('\\') || token.startsWith('$')) {
      return token
    }
  }
  return null
}

/**
 * Resolve a script token to an absolute path under the agent's config dir, so it
 * can be revealed / existence-checked. Handles the common case where the script
 * lives under `.<agentId>/…` (e.g. `$CLAUDE_PROJECT_DIR/.claude/hooks/x.sh` →
 * `<basePath>/hooks/x.sh`). Returns null when it can't be mapped confidently.
 */
export function resolveScriptPath(
  token: string,
  basePath: string,
  agentId: string,
): string | null {
  if (!basePath) return null
  const clean = token.replace(/^["']|["']$/g, '')
  const marker = `.${agentId}/`
  const at = clean.indexOf(marker)
  if (at !== -1) {
    const rest = clean.slice(at + marker.length)
    const sep = basePath.includes('\\') ? '\\' : '/'
    return `${basePath.replace(/[/\\]+$/, '')}${sep}${rest.replace(/\//g, sep)}`
  }
  // An already-absolute path with no env prefix can be used as-is.
  if (/^([A-Za-z]:[\\/]|\/)/.test(clean) && !clean.startsWith('$')) {
    return clean
  }
  return null
}

/** Whether the event uses a tool matcher at all. */
export function eventUsesMatcher(event: HookEvent): boolean {
  return MATCHER_EVENTS.has(event)
}

/**
 * Match a tool name against a Claude-style matcher: empty or `*` matches
 * everything, otherwise the matcher is an anchored regex (`Edit|Write`, etc.).
 * Returns false on an invalid regex.
 */
export function matcherMatches(matcher: string, toolName: string): boolean {
  const m = matcher.trim()
  if (m === '' || m === '*') return true
  try {
    return new RegExp(`^(?:${m})$`).test(toolName)
  } catch {
    return false
  }
}

/** Static validation for one hook. Findings are warnings — they never block. */
export function checkHook(entry: HookEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const command = entry.command.trim()
  const matcher = entry.matcher.trim()

  if (command === '') {
    issues.push({ severity: 'error', message: 'Command is empty.' })
  }

  if (matcher !== '' && !eventUsesMatcher(entry.event)) {
    issues.push({
      severity: 'warning',
      message: `${entry.event} ignores matchers — the matcher “${matcher}” has no effect.`,
    })
  }

  if (matcher !== '' && matcher !== '*' && eventUsesMatcher(entry.event)) {
    try {
      new RegExp(matcher)
    } catch {
      issues.push({
        severity: 'error',
        message: `Matcher “${matcher}” is not a valid regular expression.`,
      })
    }
  }

  if (command !== '' && DESTRUCTIVE_RE.test(command)) {
    issues.push({
      severity: 'warning',
      message:
        'Command looks destructive (e.g. rm -rf / force-reset). It runs automatically — double-check it.',
    })
  }

  if (
    entry.timeout !== undefined &&
    (!Number.isFinite(entry.timeout) || entry.timeout <= 0)
  ) {
    issues.push({
      severity: 'warning',
      message: 'Timeout should be a positive number of seconds.',
    })
  }

  return issues
}

/** Highest severity across a set of issues, or null if none. */
export function topSeverity(
  issues: ValidationIssue[],
): ValidationIssue['severity'] | null {
  if (issues.some((i) => i.severity === 'error')) return 'error'
  if (issues.some((i) => i.severity === 'warning')) return 'warning'
  if (issues.length > 0) return 'info'
  return null
}
