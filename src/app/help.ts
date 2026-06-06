/**
 * Per-page contextual help. Keyed by route so the `?` button in the top bar can
 * surface a short explanation of the concepts each page deals with (what
 * "Hooks", "MCP", "Skills" etc. actually are) without the user leaving the page.
 */
export interface HelpEntry {
  title: string
  /** Short paragraphs — kept terse, one idea each. */
  body: string[]
}

export const PAGE_HELP: Record<string, HelpEntry> = {
  '/': {
    title: 'Dashboard',
    body: [
      'Your home base: every detected AI coding agent, its install status and your current usage at a glance.',
      'Click an agent card to make it active — the rest of Abyss then edits that agent’s real config files.',
    ],
  },
  '/config': {
    title: 'Instructions',
    body: [
      'Instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, …) are loaded into every session and tell the agent how you want it to behave.',
      'Use the Global / Project toggle to edit either your machine-wide rules or a single project’s.',
    ],
  },
  '/chats': {
    title: 'Chats',
    body: [
      'Browse past conversations with the agent and, where supported, start a live chat that streams responses.',
      'In project scope only this project’s conversations are shown.',
    ],
  },
  '/context': {
    title: 'Context (compiled prompt)',
    body: [
      'Shows the layers that make up what the model actually sees — base prompt, instructions, subagents, skills, hooks and MCP schemas — with rough token estimates each.',
      'The Conflicts section flags contradictory rules, duplicated instructions and MCP servers that clash across agents.',
    ],
  },
  '/validation': {
    title: 'Validation',
    body: [
      'A linter for your AI setup: it flags dangerous permissions, oversized context, unused skills, broken MCP/hook wiring and contradictory instructions.',
      'Errors are likely breakages, warnings are risks, hints are suggestions. Re-run after edits.',
    ],
  },
  '/history': {
    title: 'History',
    body: [
      'Abyss snapshots your config files when they change so you can diff and restore earlier versions.',
      'Think of it as a lightweight, automatic undo for everything you edit here.',
    ],
  },
  '/bundles': {
    title: 'Bundles',
    body: [
      'A bundle is a portable export of your agent config — instructions, MCP servers, permissions and more in one file.',
      'Apply a bundle on another machine to reproduce the same setup.',
    ],
  },
  '/profiles': {
    title: 'Profiles',
    body: [
      'A profile is a named set of config (model, prompt, MCP servers, permissions) you can switch between — e.g. Work, Private, CI.',
      'Activating a profile applies its values to the active agent’s real config.',
    ],
  },
  '/compare': {
    title: 'Compare',
    body: [
      'Diff the config of two agents side by side and copy individual values across to keep them in sync.',
    ],
  },
  '/templates': {
    title: 'Templates',
    body: [
      'Reusable prompt snippets you can keep in one place and drop into instructions, commands or chats.',
    ],
  },
  '/agents': {
    title: 'Agents (subagents)',
    body: [
      'Subagents are specialised personas the main agent can delegate to — each with its own instructions, tools and model.',
      'They live as markdown files in the agent’s config directory.',
    ],
  },
  '/commands': {
    title: 'Commands',
    body: [
      'Custom slash commands (e.g. /review) are reusable prompts only you can trigger by name in a session. The AI Agent cant call them on its own.',
      'Each command is a markdown file with the prompt body and optional metadata.',
    ],
  },
  '/skills': {
    title: 'Skills',
    body: [
      'A skill is a self-contained capability (instructions + optional scripts) the agent loads on demand when a task matches it.',
      'Skills keep specialised know-how out of the base prompt until it’s actually needed.',
    ],
  },
  '/mcp': {
    title: 'MCP Servers',
    body: [
      'MCP (Model Context Protocol) is an open standard that lets agents talk to external tools and data sources — databases, browsers, APIs.',
      'Each MCP server exposes tools the agent can call during a session.',
    ],
  },
  '/hooks': {
    title: 'Hooks',
    body: [
      'Hooks are shell commands the agent runs automatically at lifecycle moments — before a tool call, after a session, on stop.',
      'Use them to inject context, enforce policy or run formatters/linters.',
    ],
  },
  '/permissions': {
    title: 'Permissions',
    body: [
      'Permission rules decide what the agent may do on its own. Allow runs silently, Ask prompts you first, Deny blocks it outright.',
      'Deny is your safety wall — put secrets and destructive commands here.',
    ],
  },
  '/model-env': {
    title: 'Model & Environment',
    body: [
      'Pick the model the agent uses and set environment variables (API keys, flags) that are passed into every session.',
    ],
  },
  '/settings-file': {
    title: 'Raw settings',
    body: [
      'The agent’s settings.json exactly as it sits on disk, for power edits Abyss doesn’t surface as a form.',
      'Invalid JSON is rejected so you can’t corrupt the file.',
    ],
  },
  '/settings': {
    title: 'Settings',
    body: [
      'Abyss’s own settings: config paths, appearance, agent visibility, shortcuts and backups.',
    ],
  },
}
