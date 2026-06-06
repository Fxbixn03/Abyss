import { IpcChannel } from '@/shared/types/ipc'
import { runSandboxCommand } from '@core/sandbox'
import { handle } from './handle'

export function registerSandboxIpc(): void {
  handle(IpcChannel.SandboxRun, ({ command, cwd, timeoutMs }) =>
    runSandboxCommand(command, { cwd, timeoutMs }),
  )
}
