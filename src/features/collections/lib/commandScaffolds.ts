/**
 * Curated slash-command starters for the New dialog: a useful description,
 * argument hint, tool scope and body instead of an empty file.
 */

export interface CommandScaffold {
  id: string
  label: string
  suggestedId: string
  description: string
  argumentHint: string
  allowedTools: string
  body: string
}

export const COMMAND_SCAFFOLDS: CommandScaffold[] = [
  {
    id: 'blank',
    label: 'Blank',
    suggestedId: '',
    description: '',
    argumentHint: '',
    allowedTools: '',
    body: '',
  },
  {
    id: 'review',
    label: 'Review changes',
    suggestedId: 'review',
    description: 'Review the current changes for correctness and clarity.',
    argumentHint: '[path]',
    allowedTools: 'Read, Grep, Glob, Bash',
    body: `Review the changes in $ARGUMENTS (default: the working tree) for correctness, edge cases, error handling and clarity.

Be specific: cite the file and line, explain why, and propose a concrete fix.`,
  },
  {
    id: 'tests',
    label: 'Write tests',
    suggestedId: 'write-tests',
    description: 'Write tests for the given file or feature.',
    argumentHint: '<file or feature>',
    allowedTools: 'Read, Grep, Glob, Edit, Write, Bash',
    body: `Write thorough, deterministic tests for $ARGUMENTS.

Cover happy paths, edge cases and failure modes. Keep tests fast and isolated.`,
  },
  {
    id: 'explain',
    label: 'Explain',
    suggestedId: 'explain',
    description: 'Explain how something works.',
    argumentHint: '<file, symbol or concept>',
    allowedTools: 'Read, Grep, Glob',
    body: `Explain $ARGUMENTS clearly: what it does, how it works, and why it exists.

Cite exact files and line numbers; keep it concise.`,
  },
  {
    id: 'commit',
    label: 'Commit message',
    suggestedId: 'commit-message',
    description: 'Draft a commit message for the staged changes.',
    argumentHint: '',
    allowedTools: 'Bash',
    body: `Here are the staged changes:

!\`git diff --staged\`

Write a concise, conventional commit message that summarizes them.`,
  },
]
