/**
 * Core agent type contracts.
 *
 * These are pure types (no runtime, no Node) so they are safe to import from
 * the renderer, the Electron main process, and the CLI alike.
 */

import type { CollectionKind } from './collections'

export type AgentId = string

export type ConfigScope = 'global' | 'project'

export type ConfigLanguage = 'markdown' | 'json' | 'yaml' | 'text'

export interface ConfigFileSpec {
  /** Stable id used for editor tabs / routing, e.g. 'instructions'. */
  id: string
  /** On-disk filename, e.g. 'CLAUDE.md', 'AGENTS.md'. */
  filename: string
  /** v1 ships 'global' only; the field keeps project scope open for later. */
  scope: ConfigScope
  description: string
  /** Editor syntax highlighting. */
  language: ConfigLanguage
}

export interface DetectedPath {
  path: string
  exists: boolean
  source: 'auto' | 'manual'
}

/** Whether an agent's CLI is installed, and its reported version. */
export interface AgentInstallStatus {
  installed: boolean
  version?: string
  path?: string
}

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  line?: number
  message: string
  severity: ValidationSeverity
}

export interface SidebarSection {
  id: string
  label: string
  /** lucide-react icon name, e.g. 'server'. */
  icon: string
  route: string
  /** Short tooltip shown in the sidebar. */
  description?: string
}

/** Which configuration surfaces an agent exposes in the UI. */
export interface AgentCapabilities {
  instructions: boolean
  mcp: boolean
  permissions: boolean
  modelEnv: boolean
  /** Subagent definitions (agents/*.md). */
  agents: boolean
  /** Custom slash commands (commands/*.md). */
  commands: boolean
  /** Skills (skills/<name>/SKILL.md). */
  skills: boolean
  /** Lifecycle hooks (settings.json `hooks`). */
  hooks: boolean
  /** Raw settings.json / settings.local.json editing. */
  rawSettings: boolean
  /** Browse past conversations and chat live (Chats feature). */
  chats: boolean
}

/**
 * Renderer-facing adapter. Every agent implements this. Actual disk IO is
 * delegated to the Electron main process over typed IPC — adapters never touch
 * `fs` directly.
 */
export interface AgentAdapter {
  readonly id: AgentId
  readonly name: string
  readonly displayName: string
  /** lucide-react icon name. */
  readonly icon: string
  /** Built-in theme applied by default when this agent is active. */
  readonly defaultThemeId: string
  readonly capabilities: AgentCapabilities
  /** Link to the agent's official documentation, opened from its dashboard card. */
  readonly docsUrl?: string

  getConfigFileSpecs(): ConfigFileSpec[]
  detectConfigPaths(): Promise<DetectedPath[]>
  readConfig(basePath: string, spec: ConfigFileSpec): Promise<string>
  writeConfig(
    basePath: string,
    spec: ConfigFileSpec,
    content: string,
  ): Promise<void>
  validate(spec: ConfigFileSpec, content: string): ValidationIssue[]
  /** Optional agent-specific sidebar entries (e.g. MCP for Claude). */
  getSidebarSections?(): SidebarSection[]
}

/** Host platform, kept Node-free so this type is renderer-safe. */
export type Platform = 'win32' | 'darwin' | 'linux'

/** OS roots needed to resolve agent config locations. Built by main/CLI. */
export interface OsEnv {
  home: string
  /** App-data root: %APPDATA% on Windows, ~/.config on Linux/macOS. */
  appData: string
  platform: Platform
}

/**
 * Static, framework-agnostic definition of an agent. Single source of truth for
 * ids, names, config files and path resolution. Imported by the renderer (for
 * metadata) and by main/CLI (which actually call {@link resolvePaths}).
 */
/**
 * Per-kind overrides for an agent's markdown collections. Agents store the same
 * three kinds in different places — Codex keeps its slash commands as "prompts"
 * under `prompts/`, where Claude uses `commands/`. Absent kinds fall back to the
 * directory named after the kind and the default {@link COLLECTION_LABELS}.
 */
export interface CollectionLayout {
  /** Directory under the config base. Default: the kind name. */
  dir?: string
  /** UI label override (singular/plural). Default: COLLECTION_LABELS[kind]. */
  label?: { singular: string; plural: string }
}

export interface AgentDefinition {
  id: AgentId
  name: string
  displayName: string
  defaultThemeId: string
  iconName: string
  capabilities: AgentCapabilities
  /** Link to the agent's official documentation. */
  docsUrl?: string
  /** Per-kind collection layout overrides; absent kinds use the defaults. */
  collections?: Partial<Record<CollectionKind, CollectionLayout>>
  configFiles: ConfigFileSpec[]
  /**
   * Candidate config base directories, most-preferred first. Pure function:
   * takes the OS env in, returns paths — no Node imports, so renderer-safe.
   */
  resolvePaths(env: OsEnv): string[]
}
