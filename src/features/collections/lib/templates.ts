import type { CollectionKind } from '@/shared/types/collections'
import { serializeFrontmatter } from './frontmatter'

export interface NewItemValues {
  id: string
  name: string
  description: string
  model?: string
  /** Subagent `tools` or command `allowed-tools` (comma-separated). */
  tools?: string
  /** Command `argument-hint`. */
  argumentHint?: string
  /** Optional prebuilt body (e.g. from a scaffold). */
  body?: string
}

/** Build the initial file content (frontmatter + body) for a new item. */
export function buildTemplate(kind: CollectionKind, v: NewItemValues): string {
  const name = v.name.trim() || v.id

  // Cursor rules use a distinct frontmatter (no `name`): description + globs +
  // alwaysApply control when the rule is injected into a conversation. Kept
  // hand-built so the empty `globs:` line is preserved.
  if (kind === 'rules') {
    return [
      '---',
      `description: ${v.description}`,
      'globs: ',
      'alwaysApply: false',
      '---',
      '',
      `- Describe the behaviour "${name}" should enforce.`,
      '',
    ].join('\n')
  }

  if (kind === 'commands') {
    const body =
      v.body && v.body.trim()
        ? v.body.trim()
        : `Describe what this slash command should do. The user's arguments are available as $ARGUMENTS.`
    return serializeFrontmatter(
      {
        description: v.description,
        'argument-hint': v.argumentHint ?? '',
        'allowed-tools': v.tools ?? '',
        model: v.model ?? '',
      },
      `${body}\n`,
    )
  }

  if (kind === 'agents') {
    const body =
      v.body && v.body.trim()
        ? v.body.trim()
        : `You are ${name}. Describe this subagent's role, responsibilities and step-by-step instructions here.`
    return serializeFrontmatter(
      {
        name,
        description: v.description,
        tools: v.tools ?? '',
        model: v.model?.trim() || 'sonnet',
      },
      `${body}\n`,
    )
  }

  // Skills.
  const skillBody =
    v.body && v.body.trim()
      ? v.body.trim()
      : `# ${name}\n\nDescribe what this skill does and when it should be used.`
  return serializeFrontmatter(
    { name, description: v.description, 'allowed-tools': v.tools ?? '' },
    `${skillBody}\n`,
  )
}
