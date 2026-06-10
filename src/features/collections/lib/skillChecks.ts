/**
 * Quality checks for an Agent Skill (a `SKILL.md` plus bundled files). Pure and
 * renderer-safe so the editor can run them live against the on-disk file list.
 *
 * Skills follow "progressive disclosure": the SKILL.md is the always-listed
 * entry, activated by its description; heavy detail belongs in `references/` and
 * loads on demand. So the checks flag a weak description, a bloated SKILL.md and
 * references to files that don't exist in the skill folder.
 */

import type { ValidationIssue } from '@/shared/types/agent'
import { estimateTokens } from '@/features/context/lib/tokens'

const DIR_REF =
  /(?:scripts|references|assets|examples|templates|data|prompts)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g
const MD_LINK = /\]\(([^)\s]+)\)/g

function normalizeRel(p: string): string {
  return p.replace(/^\.\//, '').trim()
}

/** Relative file paths the SKILL.md points at (bundled-file references). */
export function extractReferencedPaths(body: string): string[] {
  const found = new Set<string>()
  for (const m of body.matchAll(DIR_REF)) found.add(normalizeRel(m[0]))
  for (const m of body.matchAll(MD_LINK)) {
    const target = m[1]
    if (/^(?:https?:|mailto:|#|\/)/.test(target)) continue
    if (!/\.[A-Za-z0-9]+$/.test(target)) continue
    found.add(normalizeRel(target.split('#')[0]))
  }
  return [...found]
}

function hasUnterminatedFrontmatter(content: string): boolean {
  const t = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  if (!t.startsWith('---')) return false
  return !/^---\r?\n[\s\S]*?\r?\n---/.test(t)
}

const BODY_TOKEN_WARN = 1500

export interface SkillCheckInput {
  name: string
  description: string
  /** Full SKILL.md content (frontmatter + body). */
  content: string
  /** Body without frontmatter (for token/reference checks). */
  body: string
  /** Existing bundled file paths, relative to the skill folder (POSIX). */
  files: string[]
}

export function checkSkill(input: SkillCheckInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const description = input.description.trim()

  if (!description) {
    issues.push({
      severity: 'warning',
      message:
        'No description — skills are selected by their description, so this never auto-loads.',
    })
  } else if (description.length < 20) {
    issues.push({
      severity: 'info',
      message:
        'Short description — a clear “what it does + when to use it” improves activation.',
    })
  }

  if (hasUnterminatedFrontmatter(input.content)) {
    issues.push({
      severity: 'warning',
      message:
        'Unterminated frontmatter — the `---` block is never closed, so name/description are ignored.',
    })
  }

  if (estimateTokens(input.body) > BODY_TOKEN_WARN) {
    issues.push({
      severity: 'info',
      message:
        'SKILL.md is large. Move detail into references/ (loaded on demand) and keep the entry lean.',
    })
  }

  const fileSet = new Set(input.files.map(normalizeRel))
  for (const ref of extractReferencedPaths(input.body)) {
    if (!fileSet.has(ref)) {
      issues.push({
        severity: 'warning',
        message: `References “${ref}”, which doesn’t exist in the skill folder.`,
      })
    }
  }

  return issues
}
