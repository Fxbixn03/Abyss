import type { ConfigFileSpec, ValidationIssue } from '@/shared/types/agent'
import { checkInstructions } from '@/shared/lib/instructionChecks'

/** Lightweight validation for markdown instruction files. */
export function validateMarkdownInstructions(
  _spec: ConfigFileSpec,
  content: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (content.trim().length === 0) {
    issues.push({
      severity: 'info',
      message: 'File is empty — the agent will fall back to its defaults.',
    })
    return issues
  }

  const bytes = new TextEncoder().encode(content).length
  if (bytes > 40_000) {
    issues.push({
      severity: 'warning',
      message: `Large instruction file (${Math.round(
        bytes / 1024,
      )} KB). Very long instructions crowd the model's context window.`,
    })
  }

  // Content-aware checks: duplicate headings, likely hard-coded secrets.
  issues.push(...checkInstructions(content))

  return issues
}

/** Validate JSON content, surfacing the parse error as an issue. */
export function validateJsonContent(
  _spec: ConfigFileSpec,
  content: string,
): ValidationIssue[] {
  if (content.trim() === '') return []
  try {
    JSON.parse(content)
    return []
  } catch (error) {
    return [
      {
        severity: 'error',
        message:
          error instanceof Error ? error.message : 'Invalid JSON syntax.',
      },
    ]
  }
}
