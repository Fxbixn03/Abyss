import { app } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { readMcpServers, writeMcpServers } from '@core/mcp'
import { checkMcpHealth } from '@core/mcp-health'
import { runDiscoverySearch } from '@core/discovery'
import { indexAllConfigsCached } from '@core/global-search'
import { beginRequest, endRequest, cancelRequest } from './cancellation'
import {
  readModelEnv,
  readPermissions,
  writeModelEnv,
  writePermissions,
} from '@core/claude-settings'
import { readCodexSettings, writeCodexSettings } from '@core/codex-settings'
import { readHooks, writeHooks } from '@core/hooks'
import { readDisabledHooks, writeDisabledHooks } from '@core/disabled-hooks'
import { readRawSettings, writeRawSettings } from '@core/raw-settings'
import { assertScopedPath } from '@core/path-scope'
import { setCustomAgentDefinitions } from '@/shared/agents/defs'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerConfigIpc(ctx: IpcContext): void {
  // Defense-in-depth: a write must target a path under Abyss's allowed roots
  // (home / app-data / userData). Legitimate agent base paths always live under
  // home, so this only ever rejects a renderer pointing a write somewhere absurd.
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

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
  handle(IpcChannel.SetConfig, async ({ patch }) => {
    const next = await ctx.settings.update(patch)
    // Keep the live definition registry in sync when custom agents change, so a
    // newly created/edited agent's config IO works without restarting the app.
    if (patch.customAgents !== undefined) {
      setCustomAgentDefinitions(next.customAgents ?? [])
    }
    return next
  })

  // MCP servers
  handle(IpcChannel.GetMcpServers, ({ agentId, basePath, projectDir }) =>
    readMcpServers(agentId, basePath, projectDir),
  )
  handle(
    IpcChannel.SetMcpServers,
    ({ agentId, basePath, servers, projectDir }) =>
      writeMcpServers(
        agentId,
        scope(basePath),
        servers,
        projectDir ? scope(projectDir) : undefined,
      ),
  )
  handle(IpcChannel.McpHealthCheck, async ({ entry, requestId }) => {
    const controller = beginRequest(requestId)
    try {
      return await checkMcpHealth(entry, controller?.signal)
    } finally {
      endRequest(requestId)
    }
  })

  // Discovery (searchable registries — currently the official MCP registry)
  handle(IpcChannel.DiscoverySearch, async (req) => {
    const controller = beginRequest(req.requestId)
    try {
      return await runDiscoverySearch(req, controller?.signal)
    } finally {
      endRequest(req.requestId)
    }
  })

  // Cancel a request-tagged long-running op (discovery / MCP health)
  handle(IpcChannel.CancelRequest, ({ requestId }) => ({
    cancelled: cancelRequest(requestId),
  }))

  // Global config search across every agent (Command palette). Cached in the
  // main process; the file watcher invalidates it when a config file changes.
  handle(IpcChannel.GlobalConfigSearch, async () => {
    const settings = await ctx.settings.read()
    return indexAllConfigsCached(ctx.env, settings.agentPaths)
  })

  // Tool permissions
  handle(IpcChannel.GetPermissions, ({ basePath }) => readPermissions(basePath))
  handle(IpcChannel.SetPermissions, ({ basePath, rules }) =>
    writePermissions(scope(basePath), rules),
  )

  // Codex approval + sandbox settings
  handle(IpcChannel.GetCodexSettings, ({ basePath }) =>
    readCodexSettings(basePath),
  )
  handle(IpcChannel.SetCodexSettings, ({ basePath, settings }) =>
    writeCodexSettings(scope(basePath), settings),
  )

  // Model + env
  handle(IpcChannel.GetModelEnv, ({ basePath }) => readModelEnv(basePath))
  handle(IpcChannel.SetModelEnv, ({ basePath, config }) =>
    writeModelEnv(scope(basePath), config),
  )

  // Lifecycle hooks
  handle(IpcChannel.GetHooks, ({ agentId, basePath }) =>
    readHooks(agentId, basePath),
  )
  handle(IpcChannel.SetHooks, ({ agentId, basePath, entries }) =>
    writeHooks(agentId, scope(basePath), entries),
  )
  // Disabled (parked) hooks live in Abyss's own store, not the agent's config.
  handle(IpcChannel.GetDisabledHooks, ({ agentId, basePath }) =>
    readDisabledHooks(ctx.userData, agentId, basePath),
  )
  handle(IpcChannel.SetDisabledHooks, ({ agentId, basePath, entries }) =>
    writeDisabledHooks(ctx.userData, agentId, basePath, entries),
  )

  // Raw settings files
  handle(IpcChannel.ReadRawSettings, ({ basePath, file }) =>
    readRawSettings(basePath, file),
  )
  handle(IpcChannel.WriteRawSettings, ({ basePath, file, content }) =>
    writeRawSettings(scope(basePath), file, content),
  )
}
