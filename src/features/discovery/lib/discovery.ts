/**
 * Install hints for agents Abyss can detect but that aren't set up yet. Used by
 * the autodiscovery page to suggest how to bring a discovered agent online.
 */
export interface InstallHint {
  /** Shell command to install the CLI, when there is one. */
  command?: string
  /** Where to get it (for GUI tools like Cursor). */
  url?: string
}

export const INSTALL_HINTS: Record<string, InstallHint> = {
  claude: { command: 'npm install -g @anthropic-ai/claude-code' },
  codex: { command: 'npm install -g @openai/codex' },
  gemini: { command: 'npm install -g @google/gemini-cli' },
  cursor: { url: 'https://cursor.com/download' },
}
