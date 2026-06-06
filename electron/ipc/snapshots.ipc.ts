import { IpcChannel } from '@/shared/types/ipc'
import {
  listSnapshots,
  listRecentSnapshots,
  readSnapshot,
  restoreSnapshot,
} from '@core/snapshots'
import { handle } from './handle'

export function registerSnapshotsIpc(): void {
  handle(IpcChannel.SnapshotList, ({ path }) => listSnapshots(path))
  handle(IpcChannel.SnapshotListRecent, ({ limit }) =>
    listRecentSnapshots(limit),
  )
  handle(IpcChannel.SnapshotRead, ({ id }) => readSnapshot(id))
  handle(IpcChannel.SnapshotRestore, ({ id }) => restoreSnapshot(id))
}
