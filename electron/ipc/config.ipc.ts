import { app } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { readMcpServers, writeMcpServers } from '@core/mcp'
import { checkMcpHealth } from '@core/mcp-health'
import { runDiscoverySearch } from '@core/discovery'
import {
  readModelEnv,
  readPermissions,
  writeModelEnv,
  writePermissions,
} from '@core/claude-settings'
import { readCodexSettings, writeCodexSettings } from '@core/codex-settings'
import { readHooks, writeHooks } from '@core/hooks'
import { readRawSettings, writeRawSettings } from '@core/raw-settings'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerConfigIpc(ctx: IpcContext): void {
  handle(IpcChannel.GetAppInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
  }))

  // App settings (Abyss's own store)
  handle(IpcChannel.GetConfig, () => ctx.settings.read())
  handle(IpcChannel.SetConfig, ({ patch }) => ctx.settings.update(patch))

  // MCP servers
  handle(IpcChannel.GetMcpServers, ({ agentId, basePath, projectDir }) =>
    readMcpServers(agentId, basePath, projectDir),
  )
  handle(
    IpcChannel.SetMcpServers,
    ({ agentId, basePath, servers, projectDir }) =>
      writeMcpServers(agentId, basePath, servers, projectDir),
  )
  handle(IpcChannel.McpHealthCheck, ({ entry }) => checkMcpHealth(entry))

  // Discovery (searchable registries — currently the official MCP registry)
  handle(IpcChannel.DiscoverySearch, (req) => runDiscoverySearch(req))

  // Tool permissions
  handle(IpcChannel.GetPermissions, ({ basePath }) => readPermissions(basePath))
  handle(IpcChannel.SetPermissions, ({ basePath, rules }) =>
    writePermissions(basePath, rules),
  )

  // Codex approval + sandbox settings
  handle(IpcChannel.GetCodexSettings, ({ basePath }) =>
    readCodexSettings(basePath),
  )
  handle(IpcChannel.SetCodexSettings, ({ basePath, settings }) =>
    writeCodexSettings(basePath, settings),
  )

  // Model + env
  handle(IpcChannel.GetModelEnv, ({ basePath }) => readModelEnv(basePath))
  handle(IpcChannel.SetModelEnv, ({ basePath, config }) =>
    writeModelEnv(basePath, config),
  )

  // Lifecycle hooks
  handle(IpcChannel.GetHooks, ({ agentId, basePath }) =>
    readHooks(agentId, basePath),
  )
  handle(IpcChannel.SetHooks, ({ agentId, basePath, entries }) =>
    writeHooks(agentId, basePath, entries),
  )

  // Raw settings files
  handle(IpcChannel.ReadRawSettings, ({ basePath, file }) =>
    readRawSettings(basePath, file),
  )
  handle(IpcChannel.WriteRawSettings, ({ basePath, file, content }) =>
    writeRawSettings(basePath, file, content),
  )
}
