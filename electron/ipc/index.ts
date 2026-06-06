import type { IpcContext } from './context'
import { registerFilesystemIpc } from './filesystem.ipc'
import { registerAgentIpc } from './agent.ipc'
import { registerConfigIpc } from './config.ipc'
import { registerCollectionsIpc } from './collections.ipc'
import { registerChatIpc } from './chat.ipc'
import { registerSnapshotsIpc } from './snapshots.ipc'

/** Wire up every IPC handler group. Call once, after the app is ready. */
export function registerIpcHandlers(ctx: IpcContext): void {
  registerFilesystemIpc(ctx)
  registerAgentIpc(ctx)
  registerConfigIpc(ctx)
  registerCollectionsIpc()
  registerChatIpc(ctx)
  registerSnapshotsIpc()
}
