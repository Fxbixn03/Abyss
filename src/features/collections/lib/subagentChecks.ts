/**
 * Quality checks for a subagent definition. Pure and renderer-safe so the editor
 * can run them live. Findings are warnings/info — they guide, never block saving.
 *
 * The description matters most: agents use it to decide *when* to delegate to a
 * subagent, so an empty, too-short or near-duplicate description is flagged.
 */

import type { ValidationIssue } from '@/shared/types/agent'

export interface SubagentSibling {
  name: string
  description: string
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'for',
  'of',
  'in',
  'on',
  'with',
  'use',
  'when',
  'this',
  'that',
  'it',
  'is',
  'are',
  'be',
  'after',
  'before',
])

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

export interface SubagentCheckInput {
  name: string
  description: string
  body: string
  siblings: SubagentSibling[]
}

export function checkSubagent(input: SubagentCheckInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const name = input.name.trim()
  const description = input.description.trim()

  if (!name) {
    issues.push({
      severity: 'warning',
      message: 'No name set — the agent falls back to the file id.',
    })
  }

  if (!description) {
    issues.push({
      severity: 'warning',
      message:
        'No description — agents use it to decide when to delegate to this subagent.',
    })
  } else if (description.length < 20) {
    issues.push({
      severity: 'info',
      message:
        'Short description — a clear “what it does + when to use it” improves auto-delegation.',
    })
  }

  if (input.body.trim().length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Empty system prompt — describe the subagent’s role and steps.',
    })
  }

  // Overlap: a near-duplicate description means two subagents compete for the
  // same delegation, so neither is reliably chosen.
  if (description) {
    const mine = significantWords(description)
    for (const sib of input.siblings) {
      if (jaccard(mine, significantWords(sib.description)) >= 0.6) {
        issues.push({
          severity: 'warning',
          message: `Description overlaps “${sib.name}” — they may compete for auto-delegation. Make each one distinct.`,
        })
        break
      }
    }
  }

  return issues
}
