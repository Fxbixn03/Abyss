import { IpcChannel } from '@/shared/types/ipc'
import { runSandboxCommand } from '@core/sandbox'
import { resolveScopedPath } from '@core/path-scope'
import { logError } from '../log'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerSandboxIpc(ctx: IpcContext): void {
  handle(IpcChannel.SandboxRun, ({ command, cwd, timeoutMs }) => {
    // Defense-in-depth: confine the requested cwd to Abyss's allowed roots
    // before spawning. The runner does its own existence/dir check too; here we
    // reject a cwd that escapes home / app-data / userData up front.
    let scopedCwd = cwd
    if (cwd !== undefined) {
      const safe = resolveScopedPath(cwd, ctx.env, ctx.userData)
      if (!safe) {
        logError('SandboxRun: rejected out-of-scope cwd', cwd)
        return Promise.resolve({
          stdout: '',
          stderr: `Working directory is outside the allowed paths: ${cwd}`,
          exitCode: null,
          durationMs: 0,
          timedOut: false,
        })
      }
      scopedCwd = safe
    }
    return runSandboxCommand(command, { cwd: scopedCwd, timeoutMs })
  })
}
