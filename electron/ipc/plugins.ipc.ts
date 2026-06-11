import { IpcChannel } from '@/shared/types/ipc'
import { readPlugins, writePlugins } from '@core/plugins'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerPluginsIpc(ctx: IpcContext): void {
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.GetPlugins, ({ basePath }) => readPlugins(basePath))
  handle(IpcChannel.SetPlugins, ({ basePath, config }) =>
    writePlugins(scope(basePath), config),
  )
}
