import { IpcChannel } from '@/shared/types/ipc'
import { detectAllAgentPaths } from '@core/agent-paths'
import { readAgentConfigFile, writeAgentConfigFile } from '@core/config-io'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerAgentIpc(ctx: IpcContext): void {
  handle(IpcChannel.GetDetectedPaths, () => detectAllAgentPaths(ctx.env))

  handle(IpcChannel.ReadAgentConfig, ({ agentId, specId, basePath }) =>
    readAgentConfigFile(agentId, specId, basePath),
  )

  handle(
    IpcChannel.WriteAgentConfig,
    ({ agentId, specId, basePath, content }) =>
      writeAgentConfigFile(agentId, specId, basePath, content),
  )
}
