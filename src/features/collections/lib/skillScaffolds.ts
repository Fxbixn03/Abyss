/**
 * Curated Agent Skill starters for the New dialog: a strong description, tool
 * scope and a SKILL.md body that follows the progressive-disclosure pattern.
 * Bodies avoid hard-linking files that don't exist yet (so the missing-file
 * check stays quiet on a fresh skill).
 */

export interface SkillScaffold {
  id: string
  label: string
  suggestedId: string
  description: string
  allowedTools: string
  body: string
}

export const SKILL_SCAFFOLDS: SkillScaffold[] = [
  {
    id: 'blank',
    label: 'Blank',
    suggestedId: '',
    description: '',
    allowedTools: '',
    body: '',
  },
  {
    id: 'doc',
    label: 'Document processor',
    suggestedId: 'doc-processor',
    description:
      'Extracts and summarizes content from documents. Use when the user shares a file to analyze.',
    allowedTools: 'Read, Grep, Glob',
    body: `# Document processor

## When to use
Use this skill when the user provides a document (PDF, Markdown, text) and asks
to extract, summarize or answer questions about its content.

## Steps
1. Read the document.
2. Identify the structure (sections, tables, key facts).
3. Produce the requested output — keep it grounded in the source.

## Notes
Put long lookup tables or templates under references/ so this entry stays lean.`,
  },
  {
    id: 'api',
    label: 'API helper',
    suggestedId: 'api-helper',
    description:
      'Helps call and integrate a specific HTTP API. Use for requests, auth and response handling.',
    allowedTools: 'Read, Grep, Glob, Bash, WebFetch',
    body: `# API helper

## When to use
Use this skill when the user works with the target API — building requests,
handling auth, or mapping responses.

## Steps
1. Confirm the endpoint, method and required parameters.
2. Build the request (headers, auth, body).
3. Validate the response and surface errors clearly.

## Notes
Keep endpoint catalogues and schemas under references/ and load them on demand.`,
  },
  {
    id: 'review',
    label: 'Domain reviewer',
    suggestedId: 'domain-reviewer',
    description:
      'Reviews changes against domain-specific rules. Use before finalizing work in this area.',
    allowedTools: 'Read, Grep, Glob',
    body: `# Domain reviewer

## When to use
Use this skill to review changes against the project's domain rules and
conventions before they are finalized.

## Checklist
- Correctness against the domain rules.
- Naming and structure conventions.
- Tests cover the changed behaviour.

## Notes
Keep the detailed rulebook in references/ and cite it as needed.`,
  },
]
