/**
 * Typed IPC client for the renderer. Wraps the single `window.abyss.invoke`
 * bridge into ergonomic, fully-typed helpers. Renderer code should call these
 * instead of touching `window.abyss` (or any Node API) directly.
 */

import { IpcChannel } from '@/shared/types/ipc'
import type { IpcRequest, IpcResponse, RawSettingsFile } from '@/shared/types/ipc'
import type { AgentId } from '@/shared/types/agent'
import type {
  AppSettings,
  McpServerEntry,
  ModelEnvConfig,
  PermissionRules,
} from '@/shared/types/config'
import type { CollectionKind } from '@/shared/types/collections'
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
  pickDirectory: (title?: string, defaultPath?: string) =>
    invoke(IpcChannel.PickDirectory, { title, defaultPath }),
  revealPath: (path: string) => invoke(IpcChannel.RevealPath, { path }),

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

  getMcpServers: (agentId: AgentId, basePath: string) =>
    invoke(IpcChannel.GetMcpServers, { agentId, basePath }),
  setMcpServers: (
    agentId: AgentId,
    basePath: string,
    servers: McpServerEntry[],
  ) => invoke(IpcChannel.SetMcpServers, { agentId, basePath, servers }),

  getPermissions: (agentId: AgentId, basePath: string) =>
    invoke(IpcChannel.GetPermissions, { agentId, basePath }),
  setPermissions: (
    agentId: AgentId,
    basePath: string,
    rules: PermissionRules,
  ) => invoke(IpcChannel.SetPermissions, { agentId, basePath, rules }),

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

  getHooks: (basePath: string) => invoke(IpcChannel.GetHooks, { basePath }),
  setHooks: (basePath: string, entries: HookEntry[]) =>
    invoke(IpcChannel.SetHooks, { basePath, entries }),

  readRawSettings: (basePath: string, file: RawSettingsFile) =>
    invoke(IpcChannel.ReadRawSettings, { basePath, file }),
  writeRawSettings: (basePath: string, file: RawSettingsFile, content: string) =>
    invoke(IpcChannel.WriteRawSettings, { basePath, file, content }),
}
