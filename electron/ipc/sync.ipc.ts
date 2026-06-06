import { IpcChannel } from '@/shared/types/ipc'
import { compareSurface, copySurface, syncMcpToAll } from '@core/sync'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerSyncIpc(ctx: IpcContext): void {
  handle(IpcChannel.SyncCompare, ({ surface, agentA, agentB }) =>
    compareSurface(ctx.env, surface, agentA, agentB),
  )
  handle(IpcChannel.SyncCopy, ({ surface, fromAgent, toAgent, dryRun }) =>
    copySurface(ctx.env, surface, fromAgent, toAgent, dryRun),
  )
  handle(IpcChannel.SyncMcpAll, ({ fromAgent, dryRun }) =>
    syncMcpToAll(ctx.env, fromAgent, dryRun),
  )
}
