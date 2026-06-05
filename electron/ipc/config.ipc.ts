import { app } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { readMcpServers, writeMcpServers } from '@core/mcp'
import {
  readModelEnv,
  readPermissions,
  writeModelEnv,
  writePermissions,
} from '@core/claude-settings'
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
  handle(IpcChannel.GetMcpServers, ({ basePath }) => readMcpServers(basePath))
  handle(IpcChannel.SetMcpServers, ({ basePath, servers }) =>
    writeMcpServers(basePath, servers),
  )

  // Tool permissions
  handle(IpcChannel.GetPermissions, ({ basePath }) => readPermissions(basePath))
  handle(IpcChannel.SetPermissions, ({ basePath, rules }) =>
    writePermissions(basePath, rules),
  )

  // Model + env
  handle(IpcChannel.GetModelEnv, ({ basePath }) => readModelEnv(basePath))
  handle(IpcChannel.SetModelEnv, ({ basePath, config }) =>
    writeModelEnv(basePath, config),
  )

  // Lifecycle hooks
  handle(IpcChannel.GetHooks, ({ basePath }) => readHooks(basePath))
  handle(IpcChannel.SetHooks, ({ basePath, entries }) =>
    writeHooks(basePath, entries),
  )

  // Raw settings files
  handle(IpcChannel.ReadRawSettings, ({ basePath, file }) =>
    readRawSettings(basePath, file),
  )
  handle(IpcChannel.WriteRawSettings, ({ basePath, file, content }) =>
    writeRawSettings(basePath, file, content),
  )
}
