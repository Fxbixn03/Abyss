import type { CollectionKind } from '@/shared/types/collections'

export interface NewItemValues {
  id: string
  name: string
  description: string
  model?: string
  tools?: string
}

/** Build the initial file content (frontmatter + body) for a new item. */
export function buildTemplate(kind: CollectionKind, v: NewItemValues): string {
  const name = v.name.trim() || v.id

  // Cursor rules use a distinct frontmatter (no `name`): description + globs +
  // alwaysApply control when the rule is injected into a conversation.
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

  const front: string[] = ['---', `name: ${name}`, `description: ${v.description}`]

  if (kind === 'agents') {
    if (v.tools && v.tools.trim()) front.push(`tools: ${v.tools.trim()}`)
    front.push(`model: ${v.model?.trim() || 'sonnet'}`)
  }
  front.push('---', '')

  const body =
    kind === 'agents'
      ? `You are ${name}. Describe this subagent's role, responsibilities and step-by-step instructions here.\n`
      : kind === 'commands'
        ? `Describe what this slash command should do. The user's arguments are available as $ARGUMENTS.\n`
        : `# ${name}\n\nDescribe what this skill does and when it should be used.\n`

  return front.join('\n') + body
}
