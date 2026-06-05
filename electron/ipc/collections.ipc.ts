import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteCollectionItem,
  listCollection,
  migrateCollectionItem,
  readCollectionItem,
  writeCollectionItem,
} from '@core/collections'
import { importSkillArchive } from '@core/skill-import'
import { handle } from './handle'

export function registerCollectionsIpc(): void {
  handle(IpcChannel.ListCollection, ({ basePath, kind }) =>
    listCollection(basePath, kind),
  )
  handle(IpcChannel.ReadCollectionItem, ({ basePath, kind, id }) =>
    readCollectionItem(basePath, kind, id),
  )
  handle(IpcChannel.WriteCollectionItem, ({ basePath, kind, id, content }) =>
    writeCollectionItem(basePath, kind, id, content),
  )
  handle(IpcChannel.DeleteCollectionItem, ({ basePath, kind, id }) =>
    deleteCollectionItem(basePath, kind, id),
  )
  handle(
    IpcChannel.MigrateCollectionItem,
    ({ basePath, fromKind, toKind, id }) =>
      migrateCollectionItem(basePath, fromKind, toKind, id),
  )
  handle(IpcChannel.ImportSkill, ({ basePath, archivePath, onCollision }) =>
    importSkillArchive(basePath, archivePath, onCollision),
  )
}
