import { IpcChannel } from '@/shared/types/ipc'
import { runDoctor, applyDoctorFix } from '@core/doctor'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerDoctorIpc(ctx: IpcContext): void {
  // Same write-target guard the config handlers use: a fix can only ever touch
  // a path under Abyss's allowed roots.
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.DoctorScan, ({ agents }) => runDoctor(agents))
  handle(IpcChannel.DoctorFix, ({ fix }) => applyDoctorFix(fix, scope))
}
