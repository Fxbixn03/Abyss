import { IpcChannel } from '@/shared/types/ipc'
import {
  readStatusLine,
  removeStatusLine,
  writeStatusLine,
} from '@core/statusline'
import { readSpinner, writeSpinner } from '@core/spinner'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerStatusLineIpc(ctx: IpcContext): void {
  // The status line writes a script + settings.json under the agent's base, so
  // guard every write target against Abyss's allowed roots (same as config).
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.GetStatusLine, ({ basePath }) => readStatusLine(basePath))
  handle(IpcChannel.SetStatusLine, ({ basePath, config }) =>
    writeStatusLine(scope(basePath), config),
  )
  handle(IpcChannel.RemoveStatusLine, ({ basePath }) =>
    removeStatusLine(scope(basePath)),
  )

  // Spinner verbs & tips — sibling settings.json appearance customization.
  handle(IpcChannel.GetSpinner, ({ basePath }) => readSpinner(basePath))
  handle(IpcChannel.SetSpinner, ({ basePath, config }) =>
    writeSpinner(scope(basePath), config),
  )
}
