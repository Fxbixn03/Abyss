import { IpcChannel } from '@/shared/types/ipc'
import {
  deleteGeminiCommand,
  listGeminiCommands,
  readGeminiCommand,
  renameGeminiCommand,
  writeGeminiCommand,
} from '@core/gemini-commands'
import { handle } from './handle'

/** Gemini custom slash commands: TOML files in `<base>/commands/`. */
export function registerGeminiCommandsIpc(): void {
  handle(IpcChannel.ListGeminiCommands, ({ basePath }) =>
    listGeminiCommands(basePath),
  )
  handle(IpcChannel.ReadGeminiCommand, ({ basePath, id }) =>
    readGeminiCommand(basePath, id),
  )
  handle(IpcChannel.WriteGeminiCommand, ({ basePath, id, content }) =>
    writeGeminiCommand(basePath, id, content),
  )
  handle(IpcChannel.DeleteGeminiCommand, ({ basePath, id }) =>
    deleteGeminiCommand(basePath, id),
  )
  handle(IpcChannel.RenameGeminiCommand, ({ basePath, fromId, toId }) =>
    renameGeminiCommand(basePath, fromId, toId),
  )
}
