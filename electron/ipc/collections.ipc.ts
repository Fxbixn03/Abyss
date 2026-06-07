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
  handle(IpcChannel.ListCollection, ({ agentId, basePath, kind }) =>
    listCollection(agentId, basePath, kind),
  )
  handle(IpcChannel.ReadCollectionItem, ({ agentId, basePath, kind, id }) =>
    readCollectionItem(agentId, basePath, kind, id),
  )
  handle(
    IpcChannel.WriteCollectionItem,
    ({ agentId, basePath, kind, id, content }) =>
      writeCollectionItem(agentId, basePath, kind, id, content),
  )
  handle(IpcChannel.DeleteCollectionItem, ({ agentId, basePath, kind, id }) =>
    deleteCollectionItem(agentId, basePath, kind, id),
  )
  handle(
    IpcChannel.MigrateCollectionItem,
    ({ agentId, basePath, fromKind, toKind, id }) =>
      migrateCollectionItem(agentId, basePath, fromKind, toKind, id),
  )
  handle(
    IpcChannel.RenameCollectionItem,
    ({ agentId, basePath, kind, fromId, toId }) =>
      renameCollectionItem(agentId, basePath, kind, fromId, toId),
  )
  handle(
    IpcChannel.DuplicateCollectionItem,
    ({ agentId, basePath, kind, id, newId }) =>
      duplicateCollectionItem(agentId, basePath, kind, id, newId),
  )
  handle(
    IpcChannel.ExportCollectionItem,
    async ({ agentId, basePath, kind, id }) => {
      const { fileName, data } = await exportCollectionItem(
        agentId,
        basePath,
        kind,
        id,
      )
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
    },
  )
  handle(IpcChannel.ImportSkill, ({ basePath, archivePath, onCollision }) =>
    importSkillArchive(basePath, archivePath, onCollision),
  )
}
