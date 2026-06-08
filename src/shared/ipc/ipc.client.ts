/**
 * Typed IPC client for the renderer. Wraps the single `window.abyss.invoke`
 * bridge into ergonomic, fully-typed helpers. Renderer code should call these
 * instead of touching `window.abyss` (or any Node API) directly.
 */

import { IpcChannel, IpcEvent } from '@/shared/types/ipc'
import { decodeIpcError, IpcError, IpcErrorCode } from '@/shared/ipc/ipc-error'
import { isErrorReported, reportError } from '@/shared/lib/errors'
import type {
  ChatExportFormat,
  IpcEventMap,
  IpcRequest,
  IpcResponse,
  RawSettingsFile,
} from '@/shared/types/ipc'
import type { AgentId } from '@/shared/types/agent'
import type {
  ChatPermissionDecision,
  ChatStartOptions,
} from '@/shared/types/chat'
import type { ExportBundle } from '@/shared/types/bundle'
import type { ThemeConfig } from '@/shared/types/theme'
import type { SyncSurface } from '@/shared/types/sync'
import type {
  AppSettings,
  CodexSettings,
  McpServerEntry,
  ModelEnvConfig,
  PermissionRules,
} from '@/shared/types/config'
import type {
  CollectionKind,
  SkillCollisionMode,
} from '@/shared/types/collections'
import type { HookEntry } from '@/shared/types/hooks'
import type { DiscoverySearchRequest } from '@/shared/discovery/types'

/**
 * Codes the global safety net must never toast: config-parse failures are owned
 * by the repair flow (see `isConfigParseError`), and aborts are deliberate
 * cancellations (discovery search, MCP health checks), not user-facing errors.
 */
const SILENT_NET_CODES = new Set<string>([
  IpcErrorCode.ConfigParse,
  IpcErrorCode.Aborted,
])

/**
 * Global IPC error safety net. Many of the ~11 Zustand stores fire `ipc.*`
 * calls without their own `try/catch`, so an unhandled rejection would vanish
 * silently. This defers a fallback toast: callers that handle the error
 * themselves run `reportError` (synchronously or after their own `await`),
 * which marks the error via `markErrorReported`. By the time this timer fires,
 * a handled error is already marked and we stay quiet — so stores with proper
 * handling (e.g. `config.store.ts`) never double-toast.
 */
function armGlobalNet(err: IpcError): void {
  if (SILENT_NET_CODES.has(err.code)) return
  // A macrotask delay lets owning callers' `catch` blocks (including those that
  // only reach `reportError` after awaiting) mark the error first.
  setTimeout(() => {
    if (isErrorReported(err)) return
    // No `title` → a single plain toast carrying the error message.
    reportError(err)
  }, 0)
}

async function invoke<C extends IpcChannel>(
  channel: C,
  payload: IpcRequest<C>,
): Promise<IpcResponse<C>> {
  try {
    return await window.abyss.invoke(channel, payload)
  } catch (err) {
    // Re-throw a typed IpcError so callers can branch on `code`/`filePath`.
    const decoded = decodeIpcError(err)
    armGlobalNet(decoded)
    throw decoded
  }
}

export const ipc = {
  getAppInfo: () => invoke(IpcChannel.GetAppInfo, {}),

  getSettings: () => invoke(IpcChannel.GetConfig, {}),
  setSettings: (patch: Partial<AppSettings>) =>
    invoke(IpcChannel.SetConfig, { patch }),

  resolvePaths: (agentId: AgentId) =>
    invoke(IpcChannel.ResolvePaths, { agentId }),
  getDetectedPaths: () => invoke(IpcChannel.GetDetectedPaths, {}),
  fileExists: (path: string) => invoke(IpcChannel.FileExists, { path }),
  sandboxRun: (command: string, opts?: { cwd?: string; timeoutMs?: number }) =>
    invoke(IpcChannel.SandboxRun, { command, ...opts }),
  backupList: () => invoke(IpcChannel.BackupList, {}),
  backupRun: () => invoke(IpcChannel.BackupRun, {}),
  backupStatus: () => invoke(IpcChannel.BackupStatus, {}),
  pickDirectory: (title?: string, defaultPath?: string) =>
    invoke(IpcChannel.PickDirectory, { title, defaultPath }),
  pickFile: (options?: {
    title?: string
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => invoke(IpcChannel.PickFile, options ?? {}),
  revealPath: (path: string) => invoke(IpcChannel.RevealPath, { path }),
  openExternal: (url: string) => invoke(IpcChannel.OpenExternal, { url }),
  fsWatch: (path: string) => invoke(IpcChannel.FsWatch, { path }),
  fsUnwatch: (path: string) => invoke(IpcChannel.FsUnwatch, { path }),
  createDirectory: (path: string) =>
    invoke(IpcChannel.CreateDirectory, { path }),
  agentInstallStatus: (agentId: AgentId) =>
    invoke(IpcChannel.AgentInstallStatus, { agentId }),

  readAgentConfig: (agentId: AgentId, specId: string, basePath: string) =>
    invoke(IpcChannel.ReadAgentConfig, { agentId, specId, basePath }),
  writeAgentConfig: (
    agentId: AgentId,
    specId: string,
    basePath: string,
    content: string,
  ) =>
    invoke(IpcChannel.WriteAgentConfig, {
      agentId,
      specId,
      basePath,
      content,
    }),

  getMcpServers: (agentId: AgentId, basePath: string, projectDir?: string) =>
    invoke(IpcChannel.GetMcpServers, { agentId, basePath, projectDir }),
  setMcpServers: (
    agentId: AgentId,
    basePath: string,
    servers: McpServerEntry[],
    projectDir?: string,
  ) =>
    invoke(IpcChannel.SetMcpServers, {
      agentId,
      basePath,
      servers,
      projectDir,
    }),
  mcpHealthCheck: (entry: McpServerEntry, requestId?: string) =>
    invoke(IpcChannel.McpHealthCheck, { entry, requestId }),

  discoverySearch: (req: DiscoverySearchRequest) =>
    invoke(IpcChannel.DiscoverySearch, req),

  /** Abort an in-flight discovery / MCP-health call by its requestId. */
  cancelRequest: (requestId: string) =>
    invoke(IpcChannel.CancelRequest, { requestId }),

  globalConfigSearch: () => invoke(IpcChannel.GlobalConfigSearch, {}),

  getPermissions: (agentId: AgentId, basePath: string) =>
    invoke(IpcChannel.GetPermissions, { agentId, basePath }),
  setPermissions: (
    agentId: AgentId,
    basePath: string,
    rules: PermissionRules,
  ) => invoke(IpcChannel.SetPermissions, { agentId, basePath, rules }),

  getCodexSettings: (basePath: string) =>
    invoke(IpcChannel.GetCodexSettings, { basePath }),
  setCodexSettings: (basePath: string, settings: CodexSettings) =>
    invoke(IpcChannel.SetCodexSettings, { basePath, settings }),

  getModelEnv: (agentId: AgentId, basePath: string) =>
    invoke(IpcChannel.GetModelEnv, { agentId, basePath }),
  setModelEnv: (agentId: AgentId, basePath: string, config: ModelEnvConfig) =>
    invoke(IpcChannel.SetModelEnv, { agentId, basePath, config }),

  listCollection: (agentId: string, basePath: string, kind: CollectionKind) =>
    invoke(IpcChannel.ListCollection, { agentId, basePath, kind }),
  readCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    id: string,
  ) => invoke(IpcChannel.ReadCollectionItem, { agentId, basePath, kind, id }),
  writeCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    id: string,
    content: string,
  ) =>
    invoke(IpcChannel.WriteCollectionItem, {
      agentId,
      basePath,
      kind,
      id,
      content,
    }),
  deleteCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    id: string,
  ) => invoke(IpcChannel.DeleteCollectionItem, { agentId, basePath, kind, id }),
  migrateCollectionItem: (
    agentId: string,
    basePath: string,
    fromKind: CollectionKind,
    toKind: CollectionKind,
    id: string,
  ) =>
    invoke(IpcChannel.MigrateCollectionItem, {
      agentId,
      basePath,
      fromKind,
      toKind,
      id,
    }),
  renameCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    fromId: string,
    toId: string,
  ) =>
    invoke(IpcChannel.RenameCollectionItem, {
      agentId,
      basePath,
      kind,
      fromId,
      toId,
    }),
  duplicateCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    id: string,
    newId: string,
  ) =>
    invoke(IpcChannel.DuplicateCollectionItem, {
      agentId,
      basePath,
      kind,
      id,
      newId,
    }),
  exportCollectionItem: (
    agentId: string,
    basePath: string,
    kind: CollectionKind,
    id: string,
  ) => invoke(IpcChannel.ExportCollectionItem, { agentId, basePath, kind, id }),
  importSkill: (
    basePath: string,
    archivePath: string,
    onCollision: SkillCollisionMode,
  ) => invoke(IpcChannel.ImportSkill, { basePath, archivePath, onCollision }),

  // --- Codex custom subagents (TOML in <base>/agents/) ----------------------
  listCodexSubagents: (basePath: string) =>
    invoke(IpcChannel.ListCodexSubagents, { basePath }),
  readCodexSubagent: (basePath: string, id: string) =>
    invoke(IpcChannel.ReadCodexSubagent, { basePath, id }),
  writeCodexSubagent: (basePath: string, id: string, content: string) =>
    invoke(IpcChannel.WriteCodexSubagent, { basePath, id, content }),
  deleteCodexSubagent: (basePath: string, id: string) =>
    invoke(IpcChannel.DeleteCodexSubagent, { basePath, id }),
  renameCodexSubagent: (basePath: string, fromId: string, toId: string) =>
    invoke(IpcChannel.RenameCodexSubagent, { basePath, fromId, toId }),

  // --- Gemini custom slash commands (TOML in <base>/commands/) --------------
  listGeminiCommands: (basePath: string) =>
    invoke(IpcChannel.ListGeminiCommands, { basePath }),
  readGeminiCommand: (basePath: string, id: string) =>
    invoke(IpcChannel.ReadGeminiCommand, { basePath, id }),
  writeGeminiCommand: (basePath: string, id: string, content: string) =>
    invoke(IpcChannel.WriteGeminiCommand, { basePath, id, content }),
  deleteGeminiCommand: (basePath: string, id: string) =>
    invoke(IpcChannel.DeleteGeminiCommand, { basePath, id }),
  renameGeminiCommand: (basePath: string, fromId: string, toId: string) =>
    invoke(IpcChannel.RenameGeminiCommand, { basePath, fromId, toId }),

  getHooks: (agentId: AgentId, basePath: string) =>
    invoke(IpcChannel.GetHooks, { agentId, basePath }),
  setHooks: (agentId: AgentId, basePath: string, entries: HookEntry[]) =>
    invoke(IpcChannel.SetHooks, { agentId, basePath, entries }),

  readRawSettings: (basePath: string, file: RawSettingsFile) =>
    invoke(IpcChannel.ReadRawSettings, { basePath, file }),
  writeRawSettings: (
    basePath: string,
    file: RawSettingsFile,
    content: string,
  ) => invoke(IpcChannel.WriteRawSettings, { basePath, file, content }),

  // --- Chats: history -------------------------------------------------------
  chatListSessions: (
    agentId: AgentId,
    opts?: { offset?: number; limit?: number; cwd?: string },
  ) => invoke(IpcChannel.ChatListSessions, { agentId, ...opts }),
  chatReadSession: (agentId: AgentId, sessionId: string) =>
    invoke(IpcChannel.ChatReadSession, { agentId, sessionId }),
  chatDeleteSession: (agentId: AgentId, sessionId: string) =>
    invoke(IpcChannel.ChatDeleteSession, { agentId, sessionId }),
  chatExportSession: (
    agentId: AgentId,
    sessionId: string,
    format: ChatExportFormat,
  ) => invoke(IpcChannel.ChatExportSession, { agentId, sessionId, format }),
  chatUsageStats: (agentId: AgentId, cwd?: string) =>
    invoke(IpcChannel.ChatUsageStats, { agentId, cwd }),

  // --- Chats: auth ----------------------------------------------------------
  chatAvailability: (agentId: AgentId) =>
    invoke(IpcChannel.ChatAvailability, { agentId }),
  chatLogin: (agentId: AgentId, persist: boolean, apiKey?: string) =>
    invoke(IpcChannel.ChatLogin, { agentId, persist, apiKey }),
  chatLogout: (agentId: AgentId) => invoke(IpcChannel.ChatLogout, { agentId }),

  // --- Chats: live session --------------------------------------------------
  chatStart: (options: ChatStartOptions) =>
    invoke(IpcChannel.ChatStart, options),
  chatSend: (liveId: string, text: string) =>
    invoke(IpcChannel.ChatSend, { liveId, text }),
  chatRespondPermission: (
    liveId: string,
    requestId: string,
    decision: ChatPermissionDecision,
  ) =>
    invoke(IpcChannel.ChatRespondPermission, { liveId, requestId, decision }),
  chatInterrupt: (liveId: string) =>
    invoke(IpcChannel.ChatInterrupt, { liveId }),
  chatStop: (liveId: string) => invoke(IpcChannel.ChatStop, { liveId }),

  // --- Snapshots ------------------------------------------------------------
  listSnapshots: (path: string) => invoke(IpcChannel.SnapshotList, { path }),
  listRecentSnapshots: (limit?: number) =>
    invoke(IpcChannel.SnapshotListRecent, { limit }),
  readSnapshot: (id: string) => invoke(IpcChannel.SnapshotRead, { id }),
  restoreSnapshot: (id: string) => invoke(IpcChannel.SnapshotRestore, { id }),

  // --- Bundles --------------------------------------------------------------
  bundlePreview: (agentIds?: string[]) =>
    invoke(IpcChannel.BundlePreview, { agentIds }),
  bundleExportFile: (agentIds?: string[]) =>
    invoke(IpcChannel.BundleExportFile, { agentIds }),
  bundleLoadFile: () => invoke(IpcChannel.BundleLoadFile, {}),
  bundleApply: (bundle: ExportBundle, dryRun: boolean, agentIds?: string[]) =>
    invoke(IpcChannel.BundleApply, { bundle, agentIds, dryRun }),

  // --- Profiles -------------------------------------------------------------
  profileList: () => invoke(IpcChannel.ProfileList, {}),
  profileSave: (
    name: string,
    opts?: { agentIds?: string[]; description?: string; icon?: string },
  ) => invoke(IpcChannel.ProfileSave, { name, ...opts }),
  profileRead: (id: string) => invoke(IpcChannel.ProfileRead, { id }),
  profileApply: (id: string, dryRun: boolean, agentIds?: string[]) =>
    invoke(IpcChannel.ProfileApply, { id, agentIds, dryRun }),
  profileRename: (id: string, name: string) =>
    invoke(IpcChannel.ProfileRename, { id, name }),
  profileDelete: (id: string) => invoke(IpcChannel.ProfileDelete, { id }),

  // --- Themes ---------------------------------------------------------------
  themeExport: (theme: ThemeConfig, suggestedName: string) =>
    invoke(IpcChannel.ThemeExport, { theme, suggestedName }),
  themeImport: () => invoke(IpcChannel.ThemeImport, {}),

  // --- Auto-update ----------------------------------------------------------
  updateCheck: () => invoke(IpcChannel.UpdateCheck, {}),
  updateDownload: () => invoke(IpcChannel.UpdateDownload, {}),
  updateInstall: () => invoke(IpcChannel.UpdateInstall, {}),

  // --- Multi-agent sync & compare -------------------------------------------
  syncCompare: (surface: SyncSurface, agentA: AgentId, agentB: AgentId) =>
    invoke(IpcChannel.SyncCompare, { surface, agentA, agentB }),
  syncCopy: (
    surface: SyncSurface,
    fromAgent: AgentId,
    toAgent: AgentId,
    dryRun: boolean,
  ) => invoke(IpcChannel.SyncCopy, { surface, fromAgent, toAgent, dryRun }),
  syncMcpAll: (fromAgent: AgentId, dryRun: boolean) =>
    invoke(IpcChannel.SyncMcpAll, { fromAgent, dryRun }),

  // --- Push subscription (streaming) ---------------------------------------
  subscribe: <E extends IpcEvent>(
    event: E,
    handler: (payload: IpcEventMap[E]) => void,
  ): (() => void) => window.abyss.on(event, handler),
}
