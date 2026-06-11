import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteCollectionItem,
  duplicateCollectionItem,
  exportCollectionItem,
  listCollection,
  listSkillFiles,
  migrateCollectionItem,
  readCollectionItem,
  renameCollectionItem,
  writeCollectionItem,
} from '@core/collections'
import { importSkillArchive } from '@core/skill-import'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerCollectionsIpc(ctx: IpcContext): void {
  // Defense-in-depth: confine renderer-supplied write bases to Abyss's allowed
  // roots before creating/moving collection items (skills, agents, commands) —
  // a skill folder is agent-executed code. Reads stay unscoped, like config.ipc.
  const scope = (p: string): string =>
    assertScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.ListCollection, ({ agentId, basePath, kind }) =>
    listCollection(agentId, basePath, kind),
  )
  handle(IpcChannel.ReadCollectionItem, ({ agentId, basePath, kind, id }) =>
    readCollectionItem(agentId, basePath, kind, id),
  )
  handle(IpcChannel.ListSkillFiles, async ({ agentId, basePath, id }) => ({
    files: await listSkillFiles(agentId, basePath, id),
  }))
  handle(
    IpcChannel.WriteCollectionItem,
    ({ agentId, basePath, kind, id, content }) =>
      writeCollectionItem(agentId, scope(basePath), kind, id, content),
  )
  handle(IpcChannel.DeleteCollectionItem, ({ agentId, basePath, kind, id }) =>
    deleteCollectionItem(agentId, scope(basePath), kind, id),
  )
  handle(
    IpcChannel.MigrateCollectionItem,
    ({ agentId, basePath, fromKind, toKind, id }) =>
      migrateCollectionItem(agentId, scope(basePath), fromKind, toKind, id),
  )
  handle(
    IpcChannel.RenameCollectionItem,
    ({ agentId, basePath, kind, fromId, toId }) =>
      renameCollectionItem(agentId, scope(basePath), kind, fromId, toId),
  )
  handle(
    IpcChannel.DuplicateCollectionItem,
    ({ agentId, basePath, kind, id, newId }) =>
      duplicateCollectionItem(agentId, scope(basePath), kind, id, newId),
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
    importSkillArchive(scope(basePath), archivePath, onCollision),
  )
}
