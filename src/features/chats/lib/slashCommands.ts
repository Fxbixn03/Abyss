/** Static list of known slash commands shown in the Composer hint popover. */

export interface SlashCommand {
  /** The command token including the leading slash, e.g. '/clear'. */
  command: string
  /** One-line description shown in the popover. */
  description: string
}

/**
 * Readonly list of known Claude Code slash commands.
 * These are displayed in the Composer popover when the user types a leading '/'.
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { command: '/clear', description: 'Clear conversation history and context' },
  { command: '/compact', description: 'Clear conversation but keep a summary in context' },
  { command: '/help', description: 'Get usage help and a list of available commands' },
  { command: '/cost', description: 'Show token usage and estimated cost for this session' },
  { command: '/doctor', description: 'Check the health of the Claude Code configuration' },
  { command: '/config', description: 'Open Claude Code configuration settings' },
  { command: '/memory', description: 'Edit Claude Code memory and CLAUDE.md files' },
  { command: '/init', description: 'Initialize Claude Code for the current project' },
  { command: '/bug', description: 'Report a bug in Claude Code' },
  { command: '/review', description: 'Request a code review of recent changes' },
  { command: '/status', description: 'Show current session status and agent info' },
  { command: '/exit', description: 'Exit the current Claude Code session' },
] as const

/**
 * Filter slash commands by a query string (the text typed after the '/').
 * Returns all commands when the query is empty.
 */
export function filterSlashCommands(query: string): readonly SlashCommand[] {
  const lower = query.toLowerCase()
  if (!lower) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (c) => c.command.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower),
  )
}
