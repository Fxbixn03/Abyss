import { IpcChannel } from '@/shared/types/ipc'
import { detectAllAgentPaths } from '@core/agent-paths'
import { readAgentConfigFile, writeAgentConfigFile } from '@core/config-io'
import { detectAgentInstall } from '@core/agent-detect'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerAgentIpc(ctx: IpcContext): void {
  // Defense-in-depth: a renderer-supplied write base must resolve under Abyss's
  // allowed roots (home / app-data / userData) before we drop a config file —
  // and thus potential agent-executed code — into it. (See config.ipc.ts.)
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.GetDetectedPaths, () => detectAllAgentPaths(ctx.env))

  handle(IpcChannel.AgentInstallStatus, ({ agentId }) =>
    detectAgentInstall(agentId),
  )

  handle(IpcChannel.ReadAgentConfig, ({ agentId, specId, basePath }) =>
    readAgentConfigFile(agentId, specId, basePath),
  )

  handle(
    IpcChannel.WriteAgentConfig,
    ({ agentId, specId, basePath, content }) =>
      writeAgentConfigFile(agentId, specId, scope(basePath), content),
  )
}
