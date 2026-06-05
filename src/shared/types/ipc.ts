/**
 * Typed IPC contract — the single source of truth for every main <-> renderer
 * channel. The preload bridge exposes one generic `invoke(channel, payload)`;
 * request/response types below make every call fully type-checked end to end.
 */

import type { AgentId, DetectedPath } from './agent'
import type {
  AppInfo,
  AppSettings,
  McpServerEntry,
  ModelEnvConfig,
  PermissionRules,
} from './config'
import type { CollectionItem, CollectionKind } from './collections'
import type { HookEntry } from './hooks'

export type RawSettingsFile = 'settings.json' | 'settings.local.json'

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
  RevealPath = 'fs:reveal-path',

  // Agents
  GetDetectedPaths = 'agent:get-detected-paths',
  ReadAgentConfig = 'agent:read-config',
  WriteAgentConfig = 'agent:write-config',

  // MCP servers
  GetMcpServers = 'mcp:get',
  SetMcpServers = 'mcp:set',

  // Tool permissions
  GetPermissions = 'permissions:get',
  SetPermissions = 'permissions:set',

  // Model + env
  GetModelEnv = 'model-env:get',
  SetModelEnv = 'model-env:set',

  // Markdown collections (agents / commands / skills)
  ListCollection = 'collection:list',
  ReadCollectionItem = 'collection:read',
  WriteCollectionItem = 'collection:write',
  DeleteCollectionItem = 'collection:delete',

  // Lifecycle hooks
  GetHooks = 'hooks:get',
  SetHooks = 'hooks:set',

  // Raw settings files
  ReadRawSettings = 'raw-settings:read',
  WriteRawSettings = 'raw-settings:write',
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
  [IpcChannel.PickDirectory]: {
    request: { title?: string; defaultPath?: string }
    response: { path: string | null }
  }
  [IpcChannel.RevealPath]: {
    request: { path: string }
    response: { success: boolean }
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
    request: { agentId: AgentId; basePath: string }
    response: McpServerEntry[]
  }
  [IpcChannel.SetMcpServers]: {
    request: { agentId: AgentId; basePath: string; servers: McpServerEntry[] }
    response: { success: boolean; path: string }
  }

  [IpcChannel.GetPermissions]: {
    request: { agentId: AgentId; basePath: string }
    response: PermissionRules
  }
  [IpcChannel.SetPermissions]: {
    request: { agentId: AgentId; basePath: string; rules: PermissionRules }
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

  [IpcChannel.ListCollection]: {
    request: { basePath: string; kind: CollectionKind }
    response: CollectionItem[]
  }
  [IpcChannel.ReadCollectionItem]: {
    request: { basePath: string; kind: CollectionKind; id: string }
    response: { content: string; path: string }
  }
  [IpcChannel.WriteCollectionItem]: {
    request: {
      basePath: string
      kind: CollectionKind
      id: string
      content: string
    }
    response: { success: boolean; path: string }
  }
  [IpcChannel.DeleteCollectionItem]: {
    request: { basePath: string; kind: CollectionKind; id: string }
    response: { success: boolean }
  }

  [IpcChannel.GetHooks]: {
    request: { basePath: string }
    response: HookEntry[]
  }
  [IpcChannel.SetHooks]: {
    request: { basePath: string; entries: HookEntry[] }
    response: { success: boolean; path: string }
  }

  [IpcChannel.ReadRawSettings]: {
    request: { basePath: string; file: RawSettingsFile }
    response: { content: string; exists: boolean; path: string }
  }
  [IpcChannel.WriteRawSettings]: {
    request: { basePath: string; file: RawSettingsFile; content: string }
    response: { success: boolean; path: string }
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
}
