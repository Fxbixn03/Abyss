/**
 * User-defined ("custom") agents.
 *
 * Built-in agents are static {@link AgentDefinition}s in `defs.ts`. Custom agents
 * are instead described by a small, fully **serializable** spec that lives in the
 * persisted app settings (`AppSettings.customAgents`) so it survives restarts and
 * is readable by both the renderer and the Electron main process.
 *
 * This module is pure data + pure functions (no Node, no React): the renderer
 * imports it to build adapters, and `defs.ts` imports {@link customAgentToDefinition}
 * to turn a spec into a real {@link AgentDefinition} (with a working `resolvePaths`)
 * that both processes can register at runtime.
 */

import type {
  AgentCapabilities,
  AgentDefinition,
  ConfigLanguage,
  OsEnv,
  SidebarSection,
} from '@/shared/types/agent'

/** Default theme assigned to a new custom agent (a global, agent-agnostic theme). */
export const DEFAULT_CUSTOM_AGENT_THEME_ID = 'abyss-slate'

/** Capabilities every custom agent starts with (only instructions, the core). */
export const DEFAULT_CUSTOM_AGENT_CAPABILITIES: AgentCapabilities = {
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
}

/**
 * Serializable description of a user-created agent. Mirrors the data an
 * {@link AgentDefinition} carries, but with a flat `configDir` string (expanded
 * against the OS home at resolve time) instead of a `resolvePaths` function.
 */
export interface CustomAgentSpec {
  /** Stable slug. Unique, lowercase, must not collide with a built-in agent id. */
  id: string
  displayName: string
  /** Icon string: a Lucide name, `img:<key>` brand mark, or a `data:` image URL. */
  iconName: string
  /** Id of a built-in/custom theme applied by default when this agent is active. */
  defaultThemeId: string
  docsUrl?: string
  capabilities: AgentCapabilities
  /** The agent's main instruction file (e.g. `AGENTS.md`). */
  instructions: {
    filename: string
    language: ConfigLanguage
    description: string
  }
  /** Config base directory; a leading `~` expands to the OS home. */
  configDir: string
}

/** Expand a leading `~`/`~/` in a user path against the OS home, OS-aware. */
function expandHome(dir: string, env: OsEnv): string {
  const sep = env.platform === 'win32' ? '\\' : '/'
  const trimmed = dir.trim()
  if (trimmed === '~' || trimmed === '~/' || trimmed === '~\\') return env.home
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return `${env.home}${sep}${trimmed.slice(2)}`.replace(/[\\/]+/g, sep)
  }
  return trimmed
}

/**
 * Build a real {@link AgentDefinition} from a serializable {@link CustomAgentSpec}.
 * Pure — no Node imports — so both the renderer and main can register the result.
 */
export function customAgentToDefinition(spec: CustomAgentSpec): AgentDefinition {
  return {
    id: spec.id,
    name: spec.id,
    displayName: spec.displayName,
    defaultThemeId: spec.defaultThemeId,
    iconName: spec.iconName,
    docsUrl: spec.docsUrl,
    capabilities: spec.capabilities,
    configFiles: [
      {
        id: 'instructions',
        filename: spec.instructions.filename,
        scope: 'global',
        language: spec.instructions.language,
        description: spec.instructions.description,
      },
    ],
    resolvePaths: (env: OsEnv) => [expandHome(spec.configDir, env)],
  }
}

/** A single configurable feature surface, used to render the dialog's toggles. */
export interface CapabilityMeta {
  key: keyof AgentCapabilities
  label: string
  description: string
}

/**
 * The capabilities a user can toggle for a custom agent, with UI copy. Order is
 * the render order in the dialog. `instructions` is intentionally omitted — it is
 * always on (the core surface every agent needs).
 */
export const CUSTOM_AGENT_CAPABILITY_META: CapabilityMeta[] = [
  { key: 'mcp', label: 'MCP Servers', description: 'Model Context Protocol servers' },
  { key: 'agents', label: 'Subagents', description: 'Subagent definitions (agents/*.md)' },
  { key: 'commands', label: 'Commands', description: 'Custom slash commands' },
  { key: 'skills', label: 'Skills', description: 'Reusable skills (skills/<name>/SKILL.md)' },
  { key: 'hooks', label: 'Hooks', description: 'Lifecycle hooks' },
  { key: 'permissions', label: 'Permissions', description: 'Tool permission rules' },
  { key: 'modelEnv', label: 'Model & Env', description: 'Model & environment variables' },
  { key: 'rules', label: 'Rules', description: 'Always-on behaviour rules' },
  { key: 'rawSettings', label: 'Raw Settings', description: 'Edit settings.json directly' },
  { key: 'chats', label: 'Chats', description: 'Browse history & chat live' },
]

/**
 * Map an agent's {@link AgentCapabilities} to the sidebar entries it should show.
 * Mirrors the hand-written sections on the built-in adapters (same routes/icons)
 * so a custom agent's nav looks and behaves identically to a built-in one.
 */
export function sidebarSectionsForCapabilities(
  caps: AgentCapabilities,
): SidebarSection[] {
  const sections: SidebarSection[] = []
  if (caps.chats)
    sections.push({
      id: 'chats',
      label: 'Chats',
      icon: 'messages-square',
      route: '/chats',
      description: 'History & live chat',
    })
  if (caps.agents)
    sections.push({
      id: 'agents',
      label: 'Subagents',
      icon: 'bot',
      route: '/agents',
      description: 'Subagent definitions',
    })
  if (caps.commands)
    sections.push({
      id: 'commands',
      label: 'Commands',
      icon: 'square-slash',
      route: '/commands',
      description: 'Custom slash commands',
    })
  if (caps.skills)
    sections.push({
      id: 'skills',
      label: 'Skills',
      icon: 'graduation-cap',
      route: '/skills',
      description: 'Reusable skills',
    })
  if (caps.rules)
    sections.push({
      id: 'rules',
      label: 'Rules',
      icon: 'book-open',
      route: '/rules',
      description: 'Always-on behaviour rules',
    })
  if (caps.mcp)
    sections.push({
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol servers',
    })
  if (caps.hooks)
    sections.push({
      id: 'hooks',
      label: 'Hooks',
      icon: 'webhook',
      route: '/hooks',
      description: 'Lifecycle hooks',
    })
  if (caps.permissions)
    sections.push({
      id: 'permissions',
      label: 'Permissions',
      icon: 'shield',
      route: '/permissions',
      description: 'Tool permission rules',
    })
  if (caps.modelEnv)
    sections.push({
      id: 'model-env',
      label: 'Model & Env',
      icon: 'sliders',
      route: '/model-env',
      description: 'Model & environment',
    })
  if (caps.rawSettings)
    sections.push({
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw settings.json',
    })
  return sections
}
