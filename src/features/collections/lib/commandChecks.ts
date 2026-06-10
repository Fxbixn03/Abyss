/**
 * Quality checks for a slash command. Pure and renderer-safe so the editor can
 * run them live and feed the shared ValidationList. Findings guide, never block.
 */

import type { ValidationIssue } from '@/shared/types/agent'
import { hasArgs } from './commandArgs'

export interface CommandCheckInput {
  description: string
  argumentHint: string
  allowedTools: string
  body: string
}

/** Body uses `!`shell`` execution. */
const BASH_EXEC_RE = /!`[^`]+`/

export function checkCommand(input: CommandCheckInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!input.description.trim()) {
    issues.push({
      severity: 'warning',
      message:
        'No description — the slash menu and the SlashCommand tool use it.',
    })
  }

  if (input.body.trim().length === 0) {
    issues.push({ severity: 'warning', message: 'Empty command body.' })
  }

  if (BASH_EXEC_RE.test(input.body) && !/\bBash\b/.test(input.allowedTools)) {
    issues.push({
      severity: 'warning',
      message:
        'Uses `!`cmd`` but allowed-tools doesn’t include Bash, so it won’t run.',
    })
  }

  const bodyHasArgs = hasArgs(input.body)
  if (input.argumentHint.trim() && !bodyHasArgs) {
    issues.push({
      severity: 'info',
      message: 'argument-hint is set but the body never uses $ARGUMENTS or $1.',
    })
  }
  if (!input.argumentHint.trim() && bodyHasArgs) {
    issues.push({
      severity: 'info',
      message: 'Body uses arguments — add an argument-hint to document them.',
    })
  }

  return issues
}
