/**
 * Extra, content-aware checks for markdown instruction files: duplicate headings
 * and likely hard-coded secrets. Pure and renderer-safe so it can run live in
 * the editor and feed the existing ValidationList. Findings are warnings — they
 * inform but never block saving (only `error` does that).
 */

import type { ValidationIssue } from '@/shared/types/agent'

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^\s*(```|~~~)/

interface SecretRule {
  re: RegExp
  label: string
}

// Conservative, high-signal patterns. Generic key/secret assignments are matched
// loosely but require a reasonably long value to limit false positives.
const SECRET_RULES: SecretRule[] = [
  { re: /\bsk-[A-Za-z0-9]{20,}\b/, label: 'OpenAI API key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  { re: /\bghp_[A-Za-z0-9]{36}\b/, label: 'GitHub token' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/, label: 'GitHub token' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, label: 'Google API key' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token' },
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    label: 'private key',
  },
  {
    re: /\b(?:api[_-]?key|secret|password|access[_-]?token)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-/.]{16,}/i,
    label: 'possible secret',
  },
]

export function checkInstructions(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const lines = content.split('\n')
  const headingFirstSeen = new Map<string, number>()
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1

    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const key = heading[2].trim().toLowerCase()
      const seen = headingFirstSeen.get(key)
      if (seen === undefined) {
        headingFirstSeen.set(key, lineNo)
      } else {
        issues.push({
          severity: 'warning',
          line: lineNo,
          message: `Duplicate heading “${heading[2].trim()}” (first seen on line ${seen}).`,
        })
      }
    }

    for (const rule of SECRET_RULES) {
      if (rule.re.test(line)) {
        issues.push({
          severity: 'warning',
          line: lineNo,
          message: `Looks like a hard-coded ${rule.label} — keep secrets out of instruction files.`,
        })
        break // one secret finding per line is enough
      }
    }
  }

  return issues
}
