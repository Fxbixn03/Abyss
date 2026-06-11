import { IpcChannel } from '@/shared/types/ipc'
import { resolveScopedPath } from '@core/path-scope'
import { scanWorkspace } from '@core/workspace-scan'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerWorkspaceIpc(ctx: IpcContext): void {
  handle(IpcChannel.WorkspaceScan, async ({ rootDir }) => {
    // Same boundary the config handlers use: a renderer-supplied root can only
    // ever point inside Abyss's allowed directories. Out-of-scope → empty,
    // flagged result rather than a thrown error (the page renders a hint).
    const safe = resolveScopedPath(rootDir, ctx.env, ctx.userData)
    if (!safe) {
      return { root: rootDir, repos: [], scannedCount: 0, outOfScope: true }
    }
    return scanWorkspace(safe)
  })
}
