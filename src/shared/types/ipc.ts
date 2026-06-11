/**
 * Typed IPC contract — the single source of truth for every main <-> renderer
 * channel. The preload bridge exposes one generic `invoke(channel, payload)`;
 * request/response types below make every call fully type-checked end to end.
 */

import type { AgentId, AgentInstallStatus, DetectedPath } from './agent'
import type {
  AppInfo,
  AppSettings,
  CodexSettings,
  McpHealthResult,
  McpServerEntry,
  McpToolCallResult,
  ModelEnvConfig,
  PermissionRules,
  UpdateStatus,
} from './config'
import type {
  CollectionItem,
  CollectionKind,
  SkillCollisionMode,
  SkillFile,
  SkillImportResult,
} from './collections'
import type { CodexSubagentSummary } from './codex-subagent'
import type { GeminiCommandSummary } from './gemini-command'
import type { HookEntry } from './hooks'
import type {
  ChatAvailability,
  ChatPermissionDecision,
  ChatSessionPage,
  ChatStartOptions,
  ChatStreamEnvelope,
  ChatTranscript,
  ChatUsageStats,
  InsightsReport,
  UsageAnalytics,
} from './chat'
import type { SandboxRunResult } from './sandbox'
import type { BackupInfo, BackupStatus } from './backup'
import type { SnapshotContent, SnapshotMeta } from './snapshots'
import type { ApplyChange, ExportBundle } from './bundle'
import type { Profile, ProfileMeta } from './profiles'
import type { ThemeConfig } from './theme'
import type { TemplatePack, TemplatePackItem } from './template-pack'
import type {
  CopyResult,
  SurfaceComparison,
  SyncAllResult,
  SyncSurface,
} from './sync'
import type {
  DiscoverySearchRequest,
  DiscoverySearchResponse,
} from '../discovery/types'
import type {
  DoctorAgentInput,
  DoctorFix,
  DoctorFixResult,
  DoctorReport,
} from './doctor'
import type { GlobalSearchResult } from '../search/types'
import type { RelationGraph } from './relations'
import type { StatusLineConfig } from './statusline'
import type { SpinnerConfig } from './spinner'
import type { PluginsConfig } from './plugins'

export type RawSettingsFile = 'settings.json' | 'settings.local.json'

export type ChatExportFormat = 'markdown' | 'json'

export enum IpcChannel {
  // App / meta
  GetAppInfo = 'app:get-info',

  // App settings (persisted to userData)
  GetConfig = 'config:get',
  SetConfig = 'config:set',

  // Filesystem
  ResolvePaths = 'fs:resolve-paths',
  FileExists = 'fs:file-exists',
  PickDirectory = 'fs:pick-directory',
  PickFile = 'fs:pick-file',
  RevealPath = 'fs:reveal-path',
  OpenExternal = 'fs:open-external',
  FsWatch = 'fs:watch',
  FsUnwatch = 'fs:unwatch',
  CreateDirectory = 'fs:create-directory',
  ReadTextFile = 'fs:read-text',
  WriteTextFile = 'fs:write-text',
  SaveTextFile = 'fs:save-text',
  SandboxRun = 'sandbox:run',
  BackupList = 'backup:list',
  BackupRun = 'backup:run',
  BackupStatus = 'backup:status',
  AgentInstallStatus = 'agent:install-status',

  // Agents
  GetDetectedPaths = 'agent:get-detected-paths',
  ReadAgentConfig = 'agent:read-config',
  WriteAgentConfig = 'agent:write-config',

  // MCP servers
  GetMcpServers = 'mcp:get',
  SetMcpServers = 'mcp:set',
  McpHealthCheck = 'mcp:health-check',
  McpCallTool = 'mcp:call-tool',

  // Discovery (generic: searchable registries for mcp / skills / agents / …)
  DiscoverySearch = 'discovery:search',

  // Global config search across every agent (Command palette)
  GlobalConfigSearch = 'search:global',

  // Config Doctor (cross-agent health scan + safe auto-fixes)
  DoctorScan = 'doctor:scan',
  DoctorFix = 'doctor:fix',

  // Cancel a long-running, request-tagged op (discovery / MCP health)
  CancelRequest = 'request:cancel',

  // Tool permissions
  GetPermissions = 'permissions:get',
  SetPermissions = 'permissions:set',

  // Codex approval + sandbox settings
  GetCodexSettings = 'codex-settings:get',
  SetCodexSettings = 'codex-settings:set',

  // Model + env
  GetModelEnv = 'model-env:get',
  SetModelEnv = 'model-env:set',

  // Status line builder (Claude Code)
  GetStatusLine = 'statusline:get',
  SetStatusLine = 'statusline:set',
  RemoveStatusLine = 'statusline:remove',

  // Spinner verbs & tips (Claude Code)
  GetSpinner = 'spinner:get',
  SetSpinner = 'spinner:set',

  // Plugins & marketplaces (Claude Code)
  GetPlugins = 'plugins:get',
  SetPlugins = 'plugins:set',

  // Markdown collections (agents / commands / skills)
  ListCollection = 'collection:list',
  ReadCollectionItem = 'collection:read',
  WriteCollectionItem = 'collection:write',
  DeleteCollectionItem = 'collection:delete',
  MigrateCollectionItem = 'collection:migrate',
  RenameCollectionItem = 'collection:rename',
  DuplicateCollectionItem = 'collection:duplicate',
  ExportCollectionItem = 'collection:export',
  ImportSkill = 'collection:import-skill',
  ListSkillFiles = 'collection:list-skill-files',

  // Relations map (component graph for one agent)
  BuildRelationGraph = 'relations:build',

  // Codex custom subagents (TOML files in <base>/agents/)
  ListCodexSubagents = 'codex-subagents:list',
  ReadCodexSubagent = 'codex-subagents:read',
  WriteCodexSubagent = 'codex-subagents:write',
  DeleteCodexSubagent = 'codex-subagents:delete',
  RenameCodexSubagent = 'codex-subagents:rename',

  // Gemini custom slash commands (TOML files in <base>/commands/)
  ListGeminiCommands = 'gemini-commands:list',
  ReadGeminiCommand = 'gemini-commands:read',
  WriteGeminiCommand = 'gemini-commands:write',
  DeleteGeminiCommand = 'gemini-commands:delete',
  RenameGeminiCommand = 'gemini-commands:rename',

  // Lifecycle hooks
  GetHooks = 'hooks:get',
  SetHooks = 'hooks:set',
  GetDisabledHooks = 'hooks:get-disabled',
  SetDisabledHooks = 'hooks:set-disabled',

  // Raw settings files
  ReadRawSettings = 'raw-settings:read',
  WriteRawSettings = 'raw-settings:write',

  // Chats — history (read)
  ChatListSessions = 'chat:list-sessions',
  ChatReadSession = 'chat:read-session',
  ChatDeleteSession = 'chat:delete-session',
  ChatExportSession = 'chat:export-session',
  ChatUsageStats = 'chat:usage-stats',
  ChatUsageAnalytics = 'chat:usage-analytics',
  ChatInsights = 'chat:insights',

  // Chats — auth (subscription login lifecycle)
  ChatAvailability = 'chat:availability',
  ChatLogin = 'chat:login',
  ChatLogout = 'chat:logout',

  // Chats — live session (read/write)
  ChatStart = 'chat:start',
  ChatSend = 'chat:send',
  ChatRespondPermission = 'chat:respond-permission',
  ChatInterrupt = 'chat:interrupt',
  ChatStop = 'chat:stop',

  // Snapshots (config write safety net)
  SnapshotList = 'snapshot:list',
  SnapshotListRecent = 'snapshot:list-recent',
  SnapshotRead = 'snapshot:read',
  SnapshotCurrent = 'snapshot:current',
  SnapshotRestore = 'snapshot:restore',

  // Bundles (portable config export / apply)
  BundlePreview = 'bundle:preview',
  BundleExportFile = 'bundle:export-file',
  BundleLoadFile = 'bundle:load-file',
  BundleApply = 'bundle:apply',

  // Profiles (named config sets)
  ProfileList = 'profile:list',
  ProfileSave = 'profile:save',
  ProfileRead = 'profile:read',
  ProfileApply = 'profile:apply',
  ProfileRename = 'profile:rename',
  ProfileDelete = 'profile:delete',

  // Themes (import / export)
  ThemeExport = 'theme:export',
  ThemeImport = 'theme:import',

  // Prompt templates (import / export packs)
  TemplatesExport = 'templates:export',
  TemplatesImport = 'templates:import',

  // Auto-update
  UpdateCheck = 'update:check',
  UpdateDownload = 'update:download',
  UpdateInstall = 'update:install',

  // Multi-agent sync & compare
  SyncCompare = 'sync:compare',
  SyncCopy = 'sync:copy',
  SyncMcpAll = 'sync:mcp-all',
}

/**
 * Push channels (main → renderer). Mirrors {@link IpcMap}'s typing for the
 * event bus the preload bridge exposes via `on(...)`. This is the only
 * streaming surface; everything else is request/response over `invoke`.
 */
export enum IpcEvent {
  ChatStream = 'chat:stream',
  UpdateStatus = 'update:status',
  FileChanged = 'fs:file-changed',
}

export interface IpcEventMap {
  [IpcEvent.ChatStream]: ChatStreamEnvelope
  [IpcEvent.UpdateStatus]: UpdateStatus
  [IpcEvent.FileChanged]: { path: string }
}

/** Maps each channel to its request and response payloads. */
export interface IpcMap {
  [IpcChannel.GetAppInfo]: {
    request: Record<string, never>
    response: AppInfo
  }

  [IpcChannel.GetConfig]: {
    request: Record<string, never>
    response: AppSettings
  }
  [IpcChannel.SetConfig]: {
    request: { patch: Partial<AppSettings> }
    response: AppSettings
  }

  [IpcChannel.ResolvePaths]: {
    request: { agentId: AgentId }
    response: DetectedPath[]
  }
  [IpcChannel.FileExists]: {
    request: { path: string }
    response: { exists: boolean }
  }
  [IpcChannel.SandboxRun]: {
    request: { command: string; cwd?: string; timeoutMs?: number }
    response: SandboxRunResult
  }
  [IpcChannel.BackupList]: {
    request: Record<string, never>
    response: BackupInfo[]
  }
  [IpcChannel.BackupRun]: {
    request: Record<string, never>
    response: BackupInfo
  }
  [IpcChannel.BackupStatus]: {
    request: Record<string, never>
    response: BackupStatus
  }
  [IpcChannel.PickDirectory]: {
    request: { title?: string; defaultPath?: string }
    response: { path: string | null }
  }
  [IpcChannel.PickFile]: {
    request: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }
    response: { path: string | null }
  }
  [IpcChannel.RevealPath]: {
    request: { path: string }
    response: { success: boolean }
  }
  [IpcChannel.OpenExternal]: {
    request: { url: string }
    response: { success: boolean }
  }
  [IpcChannel.FsWatch]: {
    request: { path: string }
    response: { ok: boolean }
  }
  [IpcChannel.FsUnwatch]: {
    request: { path: string }
    response: { ok: boolean }
  }
  [IpcChannel.CreateDirectory]: {
    request: { path: string }
    response: { success: boolean }
  }
  [IpcChannel.ReadTextFile]: {
    request: { path: string }
    response: { content: string; exists: boolean }
  }
  [IpcChannel.WriteTextFile]: {
    request: { path: string; content: string; executable?: boolean }
    response: { success: boolean; path: string }
  }
  [IpcChannel.SaveTextFile]: {
    request: {
      content: string
      defaultName?: string
      title?: string
      filters?: { name: string; extensions: string[] }[]
    }
    response: { path: string | null }
  }
  [IpcChannel.AgentInstallStatus]: {
    request: { agentId: AgentId }
    response: AgentInstallStatus
  }

  [IpcChannel.GetDetectedPaths]: {
    request: Record<string, never>
    response: Record<AgentId, DetectedPath[]>
  }
  [IpcChannel.ReadAgentConfig]: {
    request: { agentId: AgentId; specId: string; basePath: string }
    response: { content: string; exists: boolean; path: string }
  }
  [IpcChannel.WriteAgentConfig]: {
    request: {
      agentId: AgentId
      specId: string
      basePath: string
      content: string
    }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetMcpServers]: {
    request: { agentId: AgentId; basePath: string; projectDir?: string }
    response: McpServerEntry[]
  }
  [IpcChannel.SetMcpServers]: {
    request: {
      agentId: AgentId
      basePath: string
      servers: McpServerEntry[]
      projectDir?: string
    }
    response: { success: boolean; path: string }
  }
  [IpcChannel.McpHealthCheck]: {
    request: { entry: McpServerEntry; requestId?: string }
    response: McpHealthResult
  }
  [IpcChannel.McpCallTool]: {
    request: {
      entry: McpServerEntry
      toolName: string
      args: Record<string, unknown>
      requestId?: string
    }
    response: McpToolCallResult
  }

  [IpcChannel.DiscoverySearch]: {
    request: DiscoverySearchRequest
    response: DiscoverySearchResponse
  }
  [IpcChannel.GlobalConfigSearch]: {
    request: Record<string, never>
    response: GlobalSearchResult[]
  }

  [IpcChannel.DoctorScan]: {
    request: { agents: DoctorAgentInput[] }
    response: DoctorReport
  }
  [IpcChannel.DoctorFix]: {
    request: { fix: DoctorFix }
    response: DoctorFixResult
  }
  [IpcChannel.CancelRequest]: {
    request: { requestId: string }
    response: { cancelled: boolean }
  }

  [IpcChannel.GetPermissions]: {
    request: { agentId: AgentId; basePath: string }
    response: PermissionRules
  }
  [IpcChannel.SetPermissions]: {
    request: { agentId: AgentId; basePath: string; rules: PermissionRules }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetCodexSettings]: {
    request: { basePath: string }
    response: CodexSettings
  }
  [IpcChannel.SetCodexSettings]: {
    request: { basePath: string; settings: CodexSettings }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetModelEnv]: {
    request: { agentId: AgentId; basePath: string }
    response: ModelEnvConfig
  }
  [IpcChannel.SetModelEnv]: {
    request: { agentId: AgentId; basePath: string; config: ModelEnvConfig }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetStatusLine]: {
    request: { basePath: string }
    response: StatusLineConfig
  }
  [IpcChannel.SetStatusLine]: {
    request: { basePath: string; config: StatusLineConfig }
    response: { success: boolean; path: string }
  }
  [IpcChannel.RemoveStatusLine]: {
    request: { basePath: string }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetSpinner]: {
    request: { basePath: string }
    response: SpinnerConfig
  }
  [IpcChannel.SetSpinner]: {
    request: { basePath: string; config: SpinnerConfig }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetPlugins]: {
    request: { basePath: string }
    response: PluginsConfig
  }
  [IpcChannel.SetPlugins]: {
    request: { basePath: string; config: PluginsConfig }
    response: { success: boolean; path: string }
  }

  [IpcChannel.ListCollection]: {
    request: { agentId: string; basePath: string; kind: CollectionKind }
    response: CollectionItem[]
  }
  [IpcChannel.ReadCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      id: string
    }
    response: { content: string; path: string }
  }
  [IpcChannel.WriteCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      id: string
      content: string
    }
    response: { success: boolean; path: string }
  }
  [IpcChannel.DeleteCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      id: string
    }
    response: { success: boolean }
  }
  [IpcChannel.MigrateCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      fromKind: CollectionKind
      toKind: CollectionKind
      id: string
    }
    response: { success: boolean; id: string; path: string }
  }
  [IpcChannel.RenameCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      fromId: string
      toId: string
    }
    response: { success: boolean; id: string; path: string }
  }
  [IpcChannel.DuplicateCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      id: string
      newId: string
    }
    response: { success: boolean; id: string; path: string }
  }
  [IpcChannel.ExportCollectionItem]: {
    request: {
      agentId: string
      basePath: string
      kind: CollectionKind
      id: string
    }
    response: { path: string | null }
  }
  [IpcChannel.ImportSkill]: {
    request: {
      basePath: string
      archivePath: string
      onCollision: SkillCollisionMode
    }
    response: SkillImportResult
  }
  [IpcChannel.ListSkillFiles]: {
    request: { agentId: string; basePath: string; id: string }
    response: { files: SkillFile[] }
  }

  [IpcChannel.BuildRelationGraph]: {
    request: { agentId: string; basePath: string; projectDir?: string }
    response: RelationGraph
  }

  [IpcChannel.ListCodexSubagents]: {
    request: { basePath: string }
    response: CodexSubagentSummary[]
  }
  [IpcChannel.ReadCodexSubagent]: {
    request: { basePath: string; id: string }
    response: { raw: string; path: string }
  }
  [IpcChannel.WriteCodexSubagent]: {
    request: { basePath: string; id: string; content: string }
    response: { success: boolean; path: string }
  }
  [IpcChannel.DeleteCodexSubagent]: {
    request: { basePath: string; id: string }
    response: { success: boolean }
  }
  [IpcChannel.RenameCodexSubagent]: {
    request: { basePath: string; fromId: string; toId: string }
    response: { success: boolean; id: string; path: string }
  }

  [IpcChannel.ListGeminiCommands]: {
    request: { basePath: string }
    response: GeminiCommandSummary[]
  }
  [IpcChannel.ReadGeminiCommand]: {
    request: { basePath: string; id: string }
    response: { raw: string; path: string }
  }
  [IpcChannel.WriteGeminiCommand]: {
    request: { basePath: string; id: string; content: string }
    response: { success: boolean; path: string }
  }
  [IpcChannel.DeleteGeminiCommand]: {
    request: { basePath: string; id: string }
    response: { success: boolean }
  }
  [IpcChannel.RenameGeminiCommand]: {
    request: { basePath: string; fromId: string; toId: string }
    response: { success: boolean; id: string; path: string }
  }

  [IpcChannel.GetHooks]: {
    request: { agentId: AgentId; basePath: string }
    response: HookEntry[]
  }
  [IpcChannel.SetHooks]: {
    request: { agentId: AgentId; basePath: string; entries: HookEntry[] }
    response: { success: boolean; path: string }
  }
  [IpcChannel.GetDisabledHooks]: {
    request: { agentId: AgentId; basePath: string }
    response: HookEntry[]
  }
  [IpcChannel.SetDisabledHooks]: {
    request: { agentId: AgentId; basePath: string; entries: HookEntry[] }
    response: { success: boolean }
  }

  [IpcChannel.ReadRawSettings]: {
    request: { basePath: string; file: RawSettingsFile }
    response: { content: string; exists: boolean; path: string }
  }
  [IpcChannel.WriteRawSettings]: {
    request: { basePath: string; file: RawSettingsFile; content: string }
    response: { success: boolean; path: string }
  }

  [IpcChannel.ChatListSessions]: {
    request: { agentId: AgentId; offset?: number; limit?: number; cwd?: string }
    response: ChatSessionPage
  }
  [IpcChannel.ChatReadSession]: {
    request: { agentId: AgentId; sessionId: string }
    response: ChatTranscript
  }
  [IpcChannel.ChatDeleteSession]: {
    request: { agentId: AgentId; sessionId: string }
    response: { success: boolean }
  }
  [IpcChannel.ChatExportSession]: {
    request: {
      agentId: AgentId
      sessionId: string
      format: ChatExportFormat
    }
    response: { path: string | null }
  }
  [IpcChannel.ChatUsageStats]: {
    request: { agentId: AgentId; cwd?: string }
    response: ChatUsageStats
  }
  [IpcChannel.ChatUsageAnalytics]: {
    request: { agentIds: AgentId[]; cwd?: string; days?: number }
    response: UsageAnalytics
  }
  [IpcChannel.ChatInsights]: {
    request: { agentId: AgentId; cwd?: string; limit?: number }
    response: InsightsReport
  }

  [IpcChannel.ChatAvailability]: {
    request: { agentId: AgentId }
    response: ChatAvailability
  }
  [IpcChannel.ChatLogin]: {
    request: { agentId: AgentId; persist: boolean; apiKey?: string }
    response: ChatAvailability
  }
  [IpcChannel.ChatLogout]: {
    request: { agentId: AgentId }
    response: { success: boolean }
  }

  [IpcChannel.ChatStart]: {
    request: ChatStartOptions
    response: { liveId: string }
  }
  [IpcChannel.ChatSend]: {
    request: { liveId: string; text: string }
    response: { success: boolean }
  }
  [IpcChannel.ChatRespondPermission]: {
    request: {
      liveId: string
      requestId: string
      decision: ChatPermissionDecision
    }
    response: { success: boolean }
  }
  [IpcChannel.ChatInterrupt]: {
    request: { liveId: string }
    response: { success: boolean }
  }
  [IpcChannel.ChatStop]: {
    request: { liveId: string }
    response: { success: boolean }
  }

  [IpcChannel.SnapshotList]: {
    request: { path: string }
    response: SnapshotMeta[]
  }
  [IpcChannel.SnapshotListRecent]: {
    request: { limit?: number }
    response: SnapshotMeta[]
  }
  [IpcChannel.SnapshotRead]: {
    request: { id: string }
    response: SnapshotContent | null
  }
  [IpcChannel.SnapshotCurrent]: {
    request: { id: string }
    response: { content: string | null }
  }
  [IpcChannel.SnapshotRestore]: {
    request: { id: string }
    response: { success: boolean; path: string } | null
  }

  [IpcChannel.BundlePreview]: {
    /** `includeSecrets` (default false) keeps real MCP env tokens in the bundle. */
    request: { agentIds?: string[]; includeSecrets?: boolean }
    response: ExportBundle
  }
  [IpcChannel.BundleExportFile]: {
    request: { agentIds?: string[]; includeSecrets?: boolean }
    response: { path: string | null }
  }
  [IpcChannel.BundleLoadFile]: {
    request: Record<string, never>
    response: { bundle: ExportBundle | null; path: string | null }
  }
  [IpcChannel.BundleApply]: {
    request: { bundle: ExportBundle; agentIds?: string[]; dryRun: boolean }
    response: ApplyChange[]
  }

  [IpcChannel.ProfileList]: {
    request: Record<string, never>
    response: ProfileMeta[]
  }
  [IpcChannel.ProfileSave]: {
    request: {
      name: string
      agentIds?: string[]
      description?: string
      icon?: string
    }
    response: ProfileMeta
  }
  [IpcChannel.ProfileRead]: {
    request: { id: string }
    response: Profile | null
  }
  [IpcChannel.ProfileApply]: {
    request: { id: string; agentIds?: string[]; dryRun: boolean }
    response: ApplyChange[]
  }
  [IpcChannel.ProfileRename]: {
    request: { id: string; name: string }
    response: ProfileMeta | null
  }
  [IpcChannel.ProfileDelete]: {
    request: { id: string }
    response: { success: boolean }
  }

  [IpcChannel.ThemeExport]: {
    request: { theme: ThemeConfig; suggestedName: string }
    response: { path: string | null }
  }
  [IpcChannel.ThemeImport]: {
    request: Record<string, never>
    response: { theme: ThemeConfig | null; error?: string }
  }

  [IpcChannel.TemplatesExport]: {
    request: { pack: TemplatePack; suggestedName: string }
    response: { path: string | null }
  }
  [IpcChannel.TemplatesImport]: {
    request: Record<string, never>
    response: { templates: TemplatePackItem[] | null; error?: string }
  }

  [IpcChannel.UpdateCheck]: {
    request: Record<string, never>
    response: { ok: boolean; error?: string }
  }
  [IpcChannel.UpdateDownload]: {
    request: Record<string, never>
    response: { ok: boolean; error?: string }
  }
  [IpcChannel.UpdateInstall]: {
    request: Record<string, never>
    response: { ok: boolean }
  }

  [IpcChannel.SyncCompare]: {
    request: { surface: SyncSurface; agentA: AgentId; agentB: AgentId }
    response: SurfaceComparison
  }
  [IpcChannel.SyncCopy]: {
    request: {
      surface: SyncSurface
      fromAgent: AgentId
      toAgent: AgentId
      dryRun: boolean
    }
    response: CopyResult
  }
  [IpcChannel.SyncMcpAll]: {
    request: { fromAgent: AgentId; dryRun: boolean }
    response: SyncAllResult[]
  }
}

export type IpcRequest<C extends IpcChannel> = IpcMap[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcMap[C]['response']

/** Shape exposed on `window.abyss` by the preload bridge. */
export interface AbyssBridge {
  invoke<C extends IpcChannel>(
    channel: C,
    payload: IpcRequest<C>,
  ): Promise<IpcResponse<C>>
  /** Subscribe to a push channel; returns an unsubscribe function. */
  on<E extends IpcEvent>(
    event: E,
    handler: (payload: IpcEventMap[E]) => void,
  ): () => void
}
