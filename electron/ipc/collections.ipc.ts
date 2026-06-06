import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteCollectionItem,
  duplicateCollectionItem,
  exportCollectionItem,
  listCollection,
  migrateCollectionItem,
  readCollectionItem,
  renameCollectionItem,
  writeCollectionItem,
} from '@core/collections'
import { importSkillArchive } from '@core/skill-import'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerCollectionsIpc(ctx: IpcContext): void {
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
  handle(IpcChannel.RenameCollectionItem, ({ basePath, kind, fromId, toId }) =>
    renameCollectionItem(basePath, kind, fromId, toId),
  )
  handle(IpcChannel.DuplicateCollectionItem, ({ basePath, kind, id, newId }) =>
    duplicateCollectionItem(basePath, kind, id, newId),
  )
  handle(IpcChannel.ExportCollectionItem, async ({ basePath, kind, id }) => {
    const { fileName, data } = await exportCollectionItem(basePath, kind, id)
    const window = ctx.getWindow()
    const ext = fileName.split('.').pop() ?? 'txt'
    const options = {
      title: 'Export',
      defaultPath: fileName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    }
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options))
    if (result.canceled || !result.filePath) return { path: null }
    await fs.writeFile(result.filePath, data)
    return { path: result.filePath }
  })
  handle(IpcChannel.ImportSkill, ({ basePath, archivePath, onCollision }) =>
    importSkillArchive(basePath, archivePath, onCollision),
  )
}
