/**
 * Ready-made instruction sections, inserted into the editor draft as a starting
 * point. Plain data so the panel and any future scaffolder can share them.
 */

export interface SectionSnippet {
  label: string
  content: string
}

export const SECTION_SNIPPETS: SectionSnippet[] = [
  {
    label: 'Project overview',
    content: `## Project overview

Briefly describe what this project is and its primary goal.`,
  },
  {
    label: 'Build & test commands',
    content: `## Build & test commands

- Install: \`...\`
- Build: \`...\`
- Test: \`...\`
- Lint: \`...\``,
  },
  {
    label: 'Conventions',
    content: `## Conventions

- Language / framework norms to follow.
- Naming, formatting and import rules.
- Patterns to prefer and anti-patterns to avoid.`,
  },
  {
    label: 'Architecture',
    content: `## Architecture

Describe the high-level structure and where things live.`,
  },
  {
    label: 'Do / Don’t',
    content: `## Do / Don’t

**Do**
- ...

**Don’t**
- ...`,
  },
]
