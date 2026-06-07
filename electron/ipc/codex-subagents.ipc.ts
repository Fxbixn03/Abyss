import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteCodexSubagent,
  listCodexSubagents,
  readCodexSubagent,
  renameCodexSubagent,
  writeCodexSubagent,
} from '@core/codex-subagents'
import { handle } from './handle'

/** Codex custom subagents: TOML files in `<base>/agents/`. */
export function registerCodexSubagentsIpc(): void {
  handle(IpcChannel.ListCodexSubagents, ({ basePath }) =>
    listCodexSubagents(basePath),
  )
  handle(IpcChannel.ReadCodexSubagent, ({ basePath, id }) =>
    readCodexSubagent(basePath, id),
  )
  handle(IpcChannel.WriteCodexSubagent, ({ basePath, id, content }) =>
    writeCodexSubagent(basePath, id, content),
  )
  handle(IpcChannel.DeleteCodexSubagent, ({ basePath, id }) =>
    deleteCodexSubagent(basePath, id),
  )
  handle(IpcChannel.RenameCodexSubagent, ({ basePath, fromId, toId }) =>
    renameCodexSubagent(basePath, fromId, toId),
  )
}
