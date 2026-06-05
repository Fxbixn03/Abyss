import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteCollectionItem,
  listCollection,
  readCollectionItem,
  writeCollectionItem,
} from '@core/collections'
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
}
