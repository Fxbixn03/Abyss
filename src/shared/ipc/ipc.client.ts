/**
 * Typed IPC client for the renderer. Wraps the single `window.abyss.invoke`
 * bridge into ergonomic, fully-typed helpers. Renderer code should call these
 * instead of touching `window.abyss` (or any Node API) directly.
 */

import { IpcChannel, IpcEvent } from '@/shared/types/ipc'
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

function invoke<C extends IpcChannel>(
  channel: C,
  payload: IpcRequest<C>,
): Promise<IpcResponse<C>> {
  return window.abyss.invoke(channel, payload)
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
  mcpHealthCheck: (entry: McpServerEntry) =>
    invoke(IpcChannel.McpHealthCheck, { entry }),

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

  listCollection: (basePath: string, kind: CollectionKind) =>
    invoke(IpcChannel.ListCollection, { basePath, kind }),
  readCollectionItem: (basePath: string, kind: CollectionKind, id: string) =>
    invoke(IpcChannel.ReadCollectionItem, { basePath, kind, id }),
  writeCollectionItem: (
    basePath: string,
    kind: CollectionKind,
    id: string,
    content: string,
  ) => invoke(IpcChannel.WriteCollectionItem, { basePath, kind, id, content }),
  deleteCollectionItem: (basePath: string, kind: CollectionKind, id: string) =>
    invoke(IpcChannel.DeleteCollectionItem, { basePath, kind, id }),
  migrateCollectionItem: (
    basePath: string,
    fromKind: CollectionKind,
    toKind: CollectionKind,
    id: string,
  ) =>
    invoke(IpcChannel.MigrateCollectionItem, {
      basePath,
      fromKind,
      toKind,
      id,
    }),
  renameCollectionItem: (
    basePath: string,
    kind: CollectionKind,
    fromId: string,
    toId: string,
  ) =>
    invoke(IpcChannel.RenameCollectionItem, { basePath, kind, fromId, toId }),
  duplicateCollectionItem: (
    basePath: string,
    kind: CollectionKind,
    id: string,
    newId: string,
  ) =>
    invoke(IpcChannel.DuplicateCollectionItem, { basePath, kind, id, newId }),
  exportCollectionItem: (basePath: string, kind: CollectionKind, id: string) =>
    invoke(IpcChannel.ExportCollectionItem, { basePath, kind, id }),
  importSkill: (
    basePath: string,
    archivePath: string,
    onCollision: SkillCollisionMode,
  ) => invoke(IpcChannel.ImportSkill, { basePath, archivePath, onCollision }),

  getHooks: (basePath: string) => invoke(IpcChannel.GetHooks, { basePath }),
  setHooks: (basePath: string, entries: HookEntry[]) =>
    invoke(IpcChannel.SetHooks, { basePath, entries }),

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
