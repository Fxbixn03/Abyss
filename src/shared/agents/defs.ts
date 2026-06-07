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

const cursorInstructions: ConfigFileSpec = {
  id: 'instructions',
  filename: '.cursorrules',
  scope: 'global',
  language: 'markdown',
  description: 'Rules for Cursor (.cursorrules).',
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
 * Gemini is the worked example for "how to add an agent". Its definition is
 * complete, but it is NOT registered in the renderer registry by default — see
 * `features/agents/registry/agent.registry.ts`.
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
    mcp: false,
    permissions: false,
    modelEnv: false,
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [geminiInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.appData, 'gemini-cli'),
    joinPath(env.platform, env.home, '.gemini'),
  ],
}

/**
 * Cursor — instructions via `.cursorrules` and MCP via `<base>/mcp.json`
 * (same JSON shape as Claude). Cursor's global config is app-internal, so the
 * `.cursor` dir is used as the editable home.
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
    agents: false,
    commands: false,
    skills: false,
    hooks: false,
    rawSettings: false,
    chats: false,
  },
  configFiles: [cursorInstructions],
  resolvePaths: (env: OsEnv) => [
    joinPath(env.platform, env.home, '.cursor'),
    joinPath(env.platform, env.appData, 'Cursor'),
  ],
}

/** Every known agent definition, keyed by id. */
export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  claude: claudeDefinition,
  codex: codexDefinition,
  gemini: geminiDefinition,
  cursor: cursorDefinition,
}

/** Agents enabled in v1 (registered in the renderer + detected by main/CLI). */
export const ACTIVE_AGENT_IDS: string[] = [
  'claude',
  'codex',
  'gemini',
  'cursor',
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
