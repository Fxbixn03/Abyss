/**
 * Framework-agnostic agent definitions — the single source of truth for agent
 * ids, display names, config files and OS path resolution.
 *
 * These are pure data + pure functions (no Node imports), so the renderer can
 * import them for metadata while the Electron main process and the CLI call
 * {@link AgentDefinition.resolvePaths} to hit the disk.
 *
 * Adding a new agent: add an entry here, create one adapter in
 * `features/agents/adapters/`, register it, and add a theme preset.
 */

import type {
  AgentDefinition,
  ConfigFileSpec,
  OsEnv,
  Platform,
} from '@/shared/types/agent'
import type { CollectionKind } from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'

/** Platform-aware path join — pure, so it stays renderer-safe. */
function joinPath(platform: Platform, ...segments: string[]): string {
  const sep = platform === 'win32' ? '\\' : '/'
  return segments
    .filter(Boolean)
    .join(sep)
    .replace(/[\\/]+/g, sep)
}

const claudeInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: 'CLAUDE.md',
  scope: 'global',
  language: 'markdown',
  description: 'Global instructions & memory loaded into every Claude session.',
}

const codexInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: 'AGENTS.md',
  scope: 'global',
  language: 'markdown',
  description: 'Global instructions for OpenAI Codex.',
}

const geminiInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: 'GEMINI.md',
  scope: 'global',
  language: 'markdown',
  description: 'Global instructions for Gemini CLI.',
}

const cursorAgentsMd: ConfigFileSpec = {
  id: 'agents-md',
  filename: 'AGENTS.md',
  scope: 'global',
  language: 'markdown',
  description: 'Project instructions for Cursor (AGENTS.md — recommended).',
}

const cursorInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: '.cursorrules',
  scope: 'global',
  language: 'markdown',
  description: 'Legacy rules for Cursor (.cursorrules).',
}

const copilotInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: 'copilot-instructions.md',
  scope: 'global',
  language: 'markdown',
  description: 'Personal global instructions for GitHub Copilot CLI.',
}

export const claudeDefinition: AgentDefinition = {
  id: 'claude',
  name: 'claude',
  displayName: 'Claude Code',
  defaultThemeId: 'claude-dusk',
  iconName: 'sparkles',
  docsUrl: 'https://platform.claude.com/docs/en/managed-agents/overview',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: true,
    modelEnv: true,
    agents: true,
    commands: true,
    skills: true,
    hooks: true,
    rules: false,
    rawSettings: true,
    chats: true,
  },
  configFiles: [claudeInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, '.claude'),
    env.platform === 'win32'
      ? joinPath(env.platform, env.appData, 'Claude')
      : joinPath(env.platform, env.appData, 'claude'),
  ],
}

export const codexDefinition: AgentDefinition = {
  id: 'codex',
  name: 'codex',
  displayName: 'OpenAI Codex',
  defaultThemeId: 'codex-terminal',
  iconName: 'terminal',
  docsUrl: 'https://developers.openai.com/codex/cli/',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: true,
    skills: true,
    hooks: false,
    rules: false,
    rawSettings: false,
    chats: true,
  },
  // Codex stores slash commands as custom "prompts" in `~/.codex/prompts/`, and
  // skills in `~/.codex/skills/<name>/SKILL.md` (same shape as Claude).
  collections: {
    commands: {
      dir: 'prompts',
      label: { singular: 'Prompt', plural: 'Prompts' },
    },
  },
  configFiles: [codexInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, '.codex'),
    env.platform === 'win32'
      ? joinPath(env.platform, env.appData, 'Codex')
      : joinPath(env.platform, env.appData, 'codex'),
  ],
}

/**
 * Gemini CLI — full feature parity with Claude where the on-disk format matches:
 * subagents (`agents/*.md`) and skills (`skills/<name>/SKILL.md`) reuse the
 * markdown-collection machinery; MCP and hooks live in `settings.json` /
 * `hooks/hooks.json`; slash commands are grouped TOML files (`commands/<g>/<n>.toml`)
 * handled by the dedicated `gemini-commands` feature.
 */
export const geminiDefinition: AgentDefinition = {
  id: 'gemini',
  name: 'gemini',
  displayName: 'Gemini CLI',
  defaultThemeId: 'gemini-cosmos',
  iconName: 'gem',
  docsUrl: 'https://github.com/google-gemini/gemini-cli',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: false,
    modelEnv: false,
    agents: true,
    commands: true,
    skills: true,
    hooks: true,
    rules: false,
    rawSettings: true,
    chats: false,
  },
  configFiles: [geminiInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.appData, 'gemini-cli'),
    joinPath(env.platform, env.home, '.gemini'),
  ],
}

/**
 * Cursor — instructions via `AGENTS.md` (recommended) + `.cursorrules` (legacy),
 * MCP via `<base>/mcp.json`, subagents/commands/skills as markdown, always-on
 * behaviour `rules/*.mdc`, and flat `hooks.json`. Cursor's global config is
 * app-internal, so the `.cursor` dir is used as the editable home.
 */
export const cursorDefinition: AgentDefinition = {
  id: 'cursor',
  name: 'cursor',
  displayName: 'Cursor',
  defaultThemeId: 'cursor-graphite',
  iconName: 'box',
  docsUrl: 'https://docs.cursor.com/',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: false,
    modelEnv: false,
    agents: true,
    commands: true,
    skills: true,
    hooks: true,
    rules: true,
    rawSettings: false,
    chats: false,
  },
  configFiles: [cursorAgentsMd, cursorInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, '.cursor'),
    joinPath(env.platform, env.appData, 'Cursor'),
  ],
}

/**
 * GitHub Copilot CLI — stores everything under `~/.copilot`: personal global
 * instructions (`copilot-instructions.md`), MCP servers (`mcp-config.json`,
 * whose stdio servers use `type: "local"`) and an editable `settings.json`.
 * Subagents (`agents/*.agent.md`) and skills use formats the markdown-collection
 * machinery doesn't model yet, so they stay off for now.
 */
export const copilotDefinition: AgentDefinition = {
  id: 'copilot',
  name: 'copilot',
  displayName: 'GitHub Copilot CLI',
  defaultThemeId: 'copilot-mono',
  iconName: 'img:copilot',
  docsUrl: 'https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rules: false,
    rawSettings: true,
    chats: false,
  },
  configFiles: [copilotInstructions],
  resolvePaths: (env: OsEnv) => [joinPath(env.platform, env.home, '.copilot')],
}

const windsurfRules: ConfigFileSpec = {
  id: 'instructions',
  filename: 'memories/global_rules.md',
  scope: 'global',
  language: 'markdown',
  description: 'Global rules applied to every Windsurf Cascade session.',
}

/**
 * Windsurf (Codeium) — global rules at `memories/global_rules.md` and MCP
 * servers in `mcp_config.json` (the standard `{ mcpServers }` JSON shape, stdio
 * servers use plain command/args), all under `~/.codeium/windsurf`.
 */
export const windsurfDefinition: AgentDefinition = {
  id: 'windsurf',
  name: 'windsurf',
  displayName: 'Windsurf',
  defaultThemeId: 'windsurf-wave',
  iconName: 'wind',
  docsUrl: 'https://docs.windsurf.com/windsurf/cascade/mcp',
  capabilities: {
    instructions: true,
    mcp: true,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rules: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [windsurfRules],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, '.codeium', 'windsurf'),
  ],
}

const continueConfig: ConfigFileSpec = {
  id: 'instructions',
  filename: 'config.yaml',
  scope: 'global',
  language: 'yaml',
  description: 'Continue global config (assistants, rules, models).',
}

/** Continue — global `config.yaml` (assistants, rules, models) in `~/.continue`. */
export const continueDefinition: AgentDefinition = {
  id: 'continue',
  name: 'continue',
  displayName: 'Continue',
  defaultThemeId: 'continue-loop',
  iconName: 'infinity',
  docsUrl: 'https://docs.continue.dev/reference',
  capabilities: {
    instructions: true,
    mcp: false,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rules: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [continueConfig],
  resolvePaths: (env: OsEnv) => [joinPath(env.platform, env.home, '.continue')],
}

const aiderConfig: ConfigFileSpec = {
  id: 'instructions',
  filename: '.aider.conf.yml',
  scope: 'global',
  language: 'yaml',
  description: 'Aider global configuration (~/.aider.conf.yml).',
}

/** Aider — YAML config at `~/.aider.conf.yml` (the home dir is the base). */
export const aiderDefinition: AgentDefinition = {
  id: 'aider',
  name: 'aider',
  displayName: 'Aider',
  defaultThemeId: 'aider-slate',
  iconName: 'terminal',
  docsUrl: 'https://aider.chat/docs/config/aider_conf.html',
  capabilities: {
    instructions: true,
    mcp: false,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rules: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [aiderConfig],
  resolvePaths: (env: OsEnv) => [joinPath(env.platform, env.home)],
}

const clineRules: ConfigFileSpec = {
  id: 'instructions',
  filename: 'instructions.md',
  scope: 'global',
  language: 'markdown',
  description: 'Global Cline rules (read from the Documents/Cline/Rules folder).',
}

/**
 * Cline — global rules folder `~/Documents/Cline/Rules` (Cline loads every
 * `.md`/`.txt` inside it). Abyss edits a single `instructions.md` there.
 */
export const clineDefinition: AgentDefinition = {
  id: 'cline',
  name: 'cline',
  displayName: 'Cline',
  defaultThemeId: 'cline-night',
  iconName: 'bot',
  docsUrl: 'https://docs.cline.bot/customization/cline-rules',
  capabilities: {
    instructions: true,
    mcp: false,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rules: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [clineRules],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, 'Documents', 'Cline', 'Rules'),
  ],
}

/** Every known agent definition, keyed by id. */
export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  claude: claudeDefinition,
  codex: codexDefinition,
  gemini: geminiDefinition,
  cursor: cursorDefinition,
  copilot: copilotDefinition,
  windsurf: windsurfDefinition,
  continue: continueDefinition,
  aider: aiderDefinition,
  cline: clineDefinition,
}

/** Agents enabled in v1 (registered in the renderer + detected by main/CLI). */
export const ACTIVE_AGENT_IDS: string[] = [
  'claude',
  'codex',
  'gemini',
  'cursor',
  'copilot',
  'windsurf',
  'continue',
  'aider',
  'cline',
]

export function getAgentDefinition(id: string): AgentDefinition {
  const def = AGENT_DEFINITIONS[id]
  if (!def) throw new Error(`Unknown agent definition: ${id}`)
  return def
}

export function getActiveAgentDefinitions(): AgentDefinition[] {
  return ACTIVE_AGENT_IDS.map(getAgentDefinition)
}

/**
 * On-disk directory name for an agent's collection of {@link CollectionKind},
 * relative to its config base. Defaults to the kind name; agents override it via
 * {@link AgentDefinition.collections} (e.g. Codex commands → `prompts`). Shared
 * by `core/collections` (to hit disk) and the renderer (for the same path).
 */
export function collectionDirName(
  agentId: string,
  kind: CollectionKind,
): string {
  return AGENT_DEFINITIONS[agentId]?.collections?.[kind]?.dir ?? kind
}

/** UI label (singular/plural) for an agent's collection of a given kind. */
export function collectionLabel(
  agentId: string,
  kind: CollectionKind,
): { singular: string; plural: string } {
  return (
    AGENT_DEFINITIONS[agentId]?.collections?.[kind]?.label ??
    COLLECTION_LABELS[kind]
  )
}
