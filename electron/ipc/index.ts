import type { IpcContext } from './context'
import { registerFilesystemIpc } from './filesystem.ipc'
import { registerAgentIpc } from './agent.ipc'
import { registerConfigIpc } from './config.ipc'
import { registerCollectionsIpc } from './collections.ipc'
import { registerRelationsIpc } from './relations.ipc'
import { registerCodexSubagentsIpc } from './codex-subagents.ipc'
import { registerGeminiCommandsIpc } from './gemini-commands.ipc'
import { registerChatIpc } from './chat.ipc'
import { registerSnapshotsIpc } from './snapshots.ipc'
import { registerBundleIpc } from './bundle.ipc'
import { registerProfilesIpc } from './profiles.ipc'
import { registerThemeIpc } from './theme.ipc'
import { registerUpdateIpc } from './update.ipc'
import { registerSyncIpc } from './sync.ipc'
import { registerSandboxIpc } from './sandbox.ipc'
import { registerBackupIpc } from './backup.ipc'

/** Wire up every IPC handler group. Call once, after the app is ready. */
export function registerIpcHandlers(ctx: IpcContext): void {
  registerFilesystemIpc(ctx)
  registerAgentIpc(ctx)
  registerConfigIpc(ctx)
  registerCollectionsIpc(ctx)
  registerRelationsIpc()
  registerCodexSubagentsIpc()
  registerGeminiCommandsIpc()
  registerChatIpc(ctx)
  registerSnapshotsIpc()
  registerBundleIpc(ctx)
  registerProfilesIpc(ctx)
  registerThemeIpc(ctx)
  registerUpdateIpc()
  registerSyncIpc(ctx)
  registerSandboxIpc(ctx)
  registerBackupIpc(ctx)
}
