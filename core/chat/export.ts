/**
 * Pure transcript → text serializers for the "export chat" action. The IPC
 * handler picks a destination via a save dialog and writes the result.
 */

import type { ChatBlock, ChatTranscript } from '@/shared/types/chat'

function blockToMarkdown(block: ChatBlock): string {
  switch (block.kind) {
    case 'text':
      return block.text
    case 'thinking':
      return `> 🧠 _${block.text.replace(/\n/g, '\n> ')}_`
    case 'tool_use':
      return `**🔧 ${block.name}**\n\n\`\`\`json\n${JSON.stringify(
        block.input,
        null,
        2,
      )}\n\`\`\``
    case 'tool_result':
      return `**↳ result${block.isError ? ' (error)' : ''}**\n\n\`\`\`\n${block.output}\n\`\`\``
    case 'image':
      return `_[image]_`
    case 'error':
      return `> ⚠️ ${block.message}`
  }
}

const ROLE_LABEL: Record<string, string> = {
  user: '👤 User',
  assistant: '🤖 Assistant',
  system: '⚙️ System',
}

export function transcriptToMarkdown(t: ChatTranscript): string {
  const header = [
    `# ${t.title}`,
    '',
    `- **Agent:** ${t.agentId}`,
    `- **Project:** ${t.projectLabel} (\`${t.cwd}\`)`,
    t.gitBranch ? `- **Branch:** ${t.gitBranch}` : '',
    t.startedAt ? `- **Started:** ${t.startedAt}` : '',
    `- **Messages:** ${t.messageCount}`,
    '',
    '---',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n')

  const body = t.messages
    .map((m) => {
      const label = ROLE_LABEL[m.role] ?? m.role
      const blocks = m.blocks.map(blockToMarkdown).join('\n\n')
      return `### ${label}\n\n${blocks}`
    })
    .join('\n\n')

  return `${header}\n${body}\n`
}

export function transcriptToJson(t: ChatTranscript): string {
  return `${JSON.stringify(t, null, 2)}\n`
}
